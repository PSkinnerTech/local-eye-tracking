import {
  FEATURE_KEYS,
  type CalibrationPoint,
  type CalibrationPointId,
  type CalibrationProfile,
  type FeatureVector,
  type FrameFeatures
} from "./types";
import { buildLearnedAttentionModel } from "./learnedClassifier";

export const MIN_VALID_SAMPLES_PER_POINT = 12;

export const CALIBRATION_POINTS: CalibrationPoint[] = [
  { id: "top-left", label: "Top left", xPercent: 12, yPercent: 14 },
  { id: "top-right", label: "Top right", xPercent: 88, yPercent: 14 },
  { id: "bottom-right", label: "Bottom right", xPercent: 88, yPercent: 86 },
  { id: "bottom-left", label: "Bottom left", xPercent: 12, yPercent: 86 },
  { id: "center", label: "Center", xPercent: 50, yPercent: 50 }
];

export const KEYBOARD_CALIBRATION_POINT: CalibrationPoint = {
  id: "keyboard",
  label: "Keyboard",
  xPercent: 50,
  yPercent: 88
};

export const CALIBRATION_SEQUENCE: CalibrationPoint[] = [
  ...CALIBRATION_POINTS,
  KEYBOARD_CALIBRATION_POINT
];

export type SamplesByPoint = Partial<Record<CalibrationPointId, FrameFeatures[]>>;

export type CalibrationBuildResult =
  | { ok: true; profile: CalibrationProfile }
  | {
      ok: false;
      reason: "insufficient-samples";
      pointId: CalibrationPointId;
    };

const TOLERANCE_FLOORS: FeatureVector = {
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

const CALIBRATION_FEATURE_WEIGHTS: FeatureVector = {
  pitch: 1.35,
  yaw: 1.1,
  eyeVertical: 1.25,
  eyeHorizontal: 0.9,
  leftEyeVertical: 1.25,
  rightEyeVertical: 1.25,
  leftEyeHorizontal: 0.9,
  rightEyeHorizontal: 0.9,
  leftEyeOpenness: 0.45,
  rightEyeOpenness: 0.45,
  faceCenterX: 0.55,
  faceCenterY: 0.55,
  faceScale: 0.45
};

export function hasEnoughSamplesForPoint(
  samples: FrameFeatures[] | undefined,
  minValidSamples = MIN_VALID_SAMPLES_PER_POINT
): boolean {
  return validSamples(samples).length >= minValidSamples;
}

export function buildCalibrationProfile(
  samplesByPoint: SamplesByPoint,
  createdAtMs = Date.now()
): CalibrationBuildResult {
  const pointsToValidate = samplesByPoint.keyboard
    ? CALIBRATION_SEQUENCE
    : CALIBRATION_POINTS;

  for (const point of pointsToValidate) {
    if (
      !hasEnoughSamplesForPoint(
        samplesByPoint[point.id],
        MIN_VALID_SAMPLES_PER_POINT
      )
    ) {
      return {
        ok: false,
        reason: "insufficient-samples",
        pointId: point.id
      };
    }
  }

  const samples = CALIBRATION_POINTS.flatMap((point) =>
    validSamples(samplesByPoint[point.id])
  );
  const keyboardSamples = validSamples(samplesByPoint.keyboard);
  const center = vectorFromSamples(samples);
  const tolerance = toleranceFromSamples(samples, center);
  const keyboardCenter =
    keyboardSamples.length > 0 ? vectorFromSamples(keyboardSamples) : undefined;
  const keyboardTolerance =
    keyboardSamples.length > 0
      ? toleranceFromSamples(keyboardSamples, keyboardCenter!)
      : undefined;
  const keyboardSeparation =
    keyboardCenter && keyboardTolerance
      ? separationBetween(center, keyboardCenter, tolerance, keyboardTolerance)
      : undefined;
  const keyboardQuality =
    keyboardSeparation === undefined
      ? undefined
      : keyboardQualityForSeparation(keyboardSeparation);
  const learnedModel =
    keyboardSamples.length > 0
      ? buildLearnedAttentionModel(samples, keyboardSamples) ??
        buildLearnedAttentionModel(
          balancedSamples(samples, keyboardSamples.length),
          keyboardSamples
        ) ??
        undefined
      : undefined;

  return {
    ok: true,
    profile: {
      createdAtMs,
      minValidSamplesPerPoint: MIN_VALID_SAMPLES_PER_POINT,
      points: pointsToValidate.map((point) => point.id),
      center,
      tolerance,
      keyboardCenter,
      keyboardTolerance,
      keyboardSeparation,
      keyboardQuality,
      learnedModel
    }
  };
}

function isValidSample(sample: FrameFeatures): boolean {
  return (
    sample.faceDetected &&
    FEATURE_KEYS.every((key) => Number.isFinite(sample[key]))
  );
}

function validSamples(samples: FrameFeatures[] | undefined): FrameFeatures[] {
  return samples?.filter(isValidSample) ?? [];
}

function balancedSamples(samples: FrameFeatures[], maxSamples: number): FrameFeatures[] {
  if (samples.length <= maxSamples) {
    return samples;
  }

  const step = samples.length / maxSamples;

  return Array.from(
    { length: maxSamples },
    (_, index) => samples[Math.floor(index * step)]
  );
}

function vectorFromSamples(samples: FrameFeatures[]): FeatureVector {
  return Object.fromEntries(
    FEATURE_KEYS.map((key) => [
      key,
      median(samples.map((sample) => sample[key]))
    ])
  ) as FeatureVector;
}

function toleranceFromSamples(
  samples: FrameFeatures[],
  center: FeatureVector
): FeatureVector {
  return Object.fromEntries(
    FEATURE_KEYS.map((key) => {
      const deviations = samples.map((sample) => Math.abs(sample[key] - center[key]));
      const tolerance = percentileValue(deviations, 0.95) * 1.8;

      return [key, Math.max(tolerance, TOLERANCE_FLOORS[key])];
    })
  ) as FeatureVector;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
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
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(percentile * sorted.length) - 1;
  const boundedIndex = Math.min(Math.max(index, 0), sorted.length - 1);

  return sorted[boundedIndex];
}

function separationBetween(
  screenCenter: FeatureVector,
  keyboardCenter: FeatureVector,
  screenTolerance: FeatureVector,
  keyboardTolerance: FeatureVector
): number {
  const weightTotal = FEATURE_KEYS.reduce(
    (sum, key) => sum + CALIBRATION_FEATURE_WEIGHTS[key],
    0
  );
  const weightedTotal = FEATURE_KEYS.reduce((sum, key) => {
    const tolerance = Math.max(
      screenTolerance[key],
      keyboardTolerance[key],
      TOLERANCE_FLOORS[key]
    );
    const normalized = Math.abs(keyboardCenter[key] - screenCenter[key]) / tolerance;

    return sum + normalized ** 2 * CALIBRATION_FEATURE_WEIGHTS[key];
  }, 0);

  return Math.sqrt(weightedTotal / weightTotal);
}

function keyboardQualityForSeparation(separation: number) {
  if (separation < 0.75) {
    return "weak";
  }

  if (separation < 1.35) {
    return "usable";
  }

  return "strong";
}
