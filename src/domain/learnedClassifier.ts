import {
  FEATURE_KEYS,
  type FeatureKey,
  type FeatureVector,
  type FrameFeatures,
  type LearnedAttentionModel
} from "./types";

export const LEARNED_FEATURE_KEYS = [
  "pitch",
  "yaw",
  "eyeVertical",
  "eyeHorizontal",
  "leftEyeVertical",
  "rightEyeVertical",
  "leftEyeHorizontal",
  "rightEyeHorizontal",
  "leftEyeOpenness",
  "rightEyeOpenness"
] as const satisfies readonly FeatureKey[];

export const LEARNED_MIN_SEPARATION = 0.75;
const LEARNED_MARGIN_THRESHOLD = 0.15;
const KEYBOARD_SCORE_THRESHOLD = 0.6;
const SCREEN_SCORE_THRESHOLD = 0.4;
// Keep robust scales slightly roomy without washing out eye-position separation.
const ROBUST_SCALE_PADDING = 1.2;

const LEARNED_TOLERANCE_FLOORS: FeatureVector = {
  pitch: 0.04,
  yaw: 0.04,
  eyeVertical: 0.035,
  eyeHorizontal: 0.04,
  faceCenterX: 0.08,
  faceCenterY: 0.08,
  faceScale: 0.06,
  leftEyeVertical: 0.035,
  rightEyeVertical: 0.035,
  leftEyeHorizontal: 0.04,
  rightEyeHorizontal: 0.04,
  leftEyeOpenness: 0.015,
  rightEyeOpenness: 0.015
};

export type LearnedAttentionDecision = {
  state: "screen" | "keyboard" | "unknown";
  screenDistance: number;
  keyboardDistance: number;
  keyboardScore: number;
  margin: number;
  modelSeparation: number;
};

export function buildLearnedAttentionModel(
  screenSamples: FrameFeatures[],
  keyboardSamples: FrameFeatures[]
): LearnedAttentionModel | null {
  const validScreenSamples = validSamples(screenSamples);
  const validKeyboardSamples = validSamples(keyboardSamples);

  if (validScreenSamples.length === 0 || validKeyboardSamples.length === 0) {
    return null;
  }

  const screenCenter = vectorFromSamples(validScreenSamples);
  const keyboardCenter = vectorFromSamples(validKeyboardSamples);
  const scale = scaleFromSamples([...validScreenSamples, ...validKeyboardSamples]);
  const keyboardSeparation = distanceBetween(screenCenter, keyboardCenter, scale);

  if (keyboardSeparation < LEARNED_MIN_SEPARATION) {
    return null;
  }

  const screenRadius = median(
    validScreenSamples.map((sample) => distanceBetween(sample, screenCenter, scale))
  );
  const keyboardRadius = median(
    validKeyboardSamples.map((sample) => distanceBetween(sample, keyboardCenter, scale))
  );

  return {
    version: 1,
    featureKeys: [...LEARNED_FEATURE_KEYS],
    screenCenter,
    keyboardCenter,
    scale,
    screenRadius,
    keyboardRadius,
    keyboardSeparation
  };
}

export function classifyWithLearnedModel(
  features: FrameFeatures,
  model: LearnedAttentionModel | undefined
): LearnedAttentionDecision | null {
  if (!isUsableModel(model) || !hasFiniteLearnedFeatures(features, model.featureKeys)) {
    return null;
  }

  const screenDistance = distanceBetween(features, model.screenCenter, model.scale, model.featureKeys);
  const keyboardDistance = distanceBetween(
    features,
    model.keyboardCenter,
    model.scale,
    model.featureKeys
  );
  const distanceTotal = screenDistance + keyboardDistance;
  const keyboardScore = distanceTotal > 0 ? screenDistance / distanceTotal : 0.5;
  const margin = screenDistance - keyboardDistance;

  if (keyboardScore >= KEYBOARD_SCORE_THRESHOLD && margin >= LEARNED_MARGIN_THRESHOLD) {
    return {
      state: "keyboard",
      screenDistance,
      keyboardDistance,
      keyboardScore,
      margin,
      modelSeparation: model.keyboardSeparation
    };
  }

  if (keyboardScore <= SCREEN_SCORE_THRESHOLD && margin <= -LEARNED_MARGIN_THRESHOLD) {
    return {
      state: "screen",
      screenDistance,
      keyboardDistance,
      keyboardScore,
      margin,
      modelSeparation: model.keyboardSeparation
    };
  }

  return {
    state: "unknown",
    screenDistance,
    keyboardDistance,
    keyboardScore,
    margin,
    modelSeparation: model.keyboardSeparation
  };
}

function isUsableModel(
  model: LearnedAttentionModel | undefined
): model is LearnedAttentionModel {
  return Boolean(
    model &&
      model.version === 1 &&
      Array.isArray(model.featureKeys) &&
      model.featureKeys.length > 0 &&
      Number.isFinite(model.keyboardSeparation) &&
      model.keyboardSeparation >= LEARNED_MIN_SEPARATION &&
      isFiniteFeatureVector(model.screenCenter, model.featureKeys) &&
      isFiniteFeatureVector(model.keyboardCenter, model.featureKeys) &&
      isFiniteFeatureVector(model.scale, model.featureKeys) &&
      model.featureKeys.every(
        (key) =>
          (LEARNED_FEATURE_KEYS as readonly FeatureKey[]).includes(key) &&
          model.scale[key] > 0
      )
  );
}

function isFiniteFeatureVector(
  vector: FeatureVector | undefined,
  featureKeys: readonly FeatureKey[]
): vector is FeatureVector {
  return Boolean(vector && featureKeys.every((key) => Number.isFinite(vector[key])));
}

function validSamples(samples: FrameFeatures[]): FrameFeatures[] {
  return samples.filter(
    (sample) => sample.faceDetected && hasFiniteLearnedFeatures(sample, LEARNED_FEATURE_KEYS)
  );
}

function hasFiniteLearnedFeatures(
  sample: FrameFeatures,
  featureKeys: readonly FeatureKey[]
): boolean {
  return featureKeys.every((key) => Number.isFinite(sample[key]));
}

function vectorFromSamples(samples: FrameFeatures[]): FeatureVector {
  return Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, median(samples.map((sample) => sample[key]))])
  ) as FeatureVector;
}

function scaleFromSamples(samples: FrameFeatures[]): FeatureVector {
  const center = vectorFromSamples(samples);

  return Object.fromEntries(
    FEATURE_KEYS.map((key) => {
      const deviations = samples.map((sample) => Math.abs(sample[key] - center[key]));
      const robustScale = percentileValue(deviations, 0.95) * ROBUST_SCALE_PADDING;

      return [key, Math.max(robustScale, LEARNED_TOLERANCE_FLOORS[key])];
    })
  ) as FeatureVector;
}

function distanceBetween(
  left: FeatureVector,
  right: FeatureVector,
  scale: FeatureVector,
  featureKeys: readonly FeatureKey[] = LEARNED_FEATURE_KEYS
): number {
  const total = featureKeys.reduce((sum, key) => {
    const normalized = Math.abs(left[key] - right[key]) / Math.max(scale[key], 0.0001);

    return sum + normalized ** 2;
  }, 0);

  return Math.sqrt(total / featureKeys.length);
}

function median(values: number[]): number {
  const sorted = [...values]
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length === 0) {
    return 0;
  }

  if (sorted.length % 2 === 1) {
    return sorted[middleIndex];
  }

  return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
}

function percentileValue(values: number[], percentile: number): number {
  const sorted = [...values]
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (sorted.length === 0) {
    return 0;
  }

  const index = Math.ceil(percentile * sorted.length) - 1;
  const boundedIndex = Math.min(Math.max(index, 0), sorted.length - 1);

  return sorted[boundedIndex];
}
