import {
  FEATURE_KEYS,
  type AttentionResult,
  type CalibrationProfile,
  type FeatureKey,
  type FrameFeatures
} from "./types";
import { classifyWithLearnedModel } from "./learnedClassifier";

export const LOOKING_DISTANCE_THRESHOLD = 1;
export const AWAY_DISTANCE_THRESHOLD = 1.65;
const KEYBOARD_SCORE_AWAY_THRESHOLD = 0.55;
const KEYBOARD_SCORE_STRONG_AWAY_THRESHOLD = 0.75;
const KEYBOARD_DISTANCE_GRACE = 0.25;
const MIN_KEYBOARD_SEPARATION = 0.75;
const SIDE_GAZE_AWAY_THRESHOLD = 0.65;
const SIDE_GAZE_STRONG_AWAY_THRESHOLD = 1.8;
const SIDE_GAZE_DOMINANCE_RATIO = 1.1;
const DISTANCE_EPSILON = 1e-14;

const FEATURE_WEIGHTS: Record<FeatureKey, number> = {
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

const MIN_TOLERANCE = 0.0001;

export function classifyAttention(
  features: FrameFeatures | null,
  profile: CalibrationProfile
): AttentionResult {
  if (!features || !features.faceDetected) {
    return {
      rawState: "face-missing",
      confidence: 1,
      distance: Number.POSITIVE_INFINITY,
      trackingScore: 0
    };
  }

  if (
    FEATURE_KEYS.some(
      (key) =>
        !Number.isFinite(features[key]) ||
        !Number.isFinite(profile.center[key]) ||
        !Number.isFinite(profile.tolerance[key])
    )
  ) {
    return {
      rawState: "unknown",
      confidence: 0,
      distance: Number.POSITIVE_INFINITY,
      trackingScore: 0
    };
  }

  const distance = weightedDistance(features, profile.center, profile.tolerance);
  const keyboard = keyboardDiagnostics(features, profile);
  const sideGaze = sideGazeDiagnostics(features, profile);
  const learned = learnedDiagnostics(features, profile);
  const trackingScore = trackingScoreForDistance(distance);

  if (
    sideGaze.sideGazeScore >= SIDE_GAZE_AWAY_THRESHOLD &&
    sideGaze.sideGazeScore >= distance * SIDE_GAZE_DOMINANCE_RATIO &&
    (distance <= LOOKING_DISTANCE_THRESHOLD + DISTANCE_EPSILON ||
      sideGaze.sideGazeScore >= SIDE_GAZE_STRONG_AWAY_THRESHOLD)
  ) {
    return {
      rawState: "away",
      confidence: clamp01((sideGaze.sideGazeScore - 0.85) / 1.1),
      distance,
      trackingScore: 0,
      screenDistance: distance,
      ...sideGaze,
      ...keyboard,
      ...(learned
        ? {
            learnedScreenDistance: learned.learnedScreenDistance,
            learnedKeyboardDistance: learned.learnedKeyboardDistance,
            learnedKeyboardScore: learned.learnedKeyboardScore,
            learnedMargin: learned.learnedMargin,
            learnedModelSeparation: learned.learnedModelSeparation
          }
        : {})
    };
  }

  if (learned?.decision.state === "keyboard") {
    return {
      rawState: "away",
      confidence: clamp01(learned.learnedKeyboardScore),
      distance,
      trackingScore: 0,
      screenDistance: distance,
      ...sideGaze,
      ...keyboard,
      learnedScreenDistance: learned.learnedScreenDistance,
      learnedKeyboardDistance: learned.learnedKeyboardDistance,
      learnedKeyboardScore: learned.learnedKeyboardScore,
      learnedMargin: learned.learnedMargin,
      learnedModelSeparation: learned.learnedModelSeparation
    };
  }

  if (learned?.decision.state === "screen") {
    return {
      rawState: "looking",
      confidence: clamp01(1 - learned.learnedKeyboardScore),
      distance,
      trackingScore,
      screenDistance: distance,
      ...sideGaze,
      ...keyboard,
      learnedScreenDistance: learned.learnedScreenDistance,
      learnedKeyboardDistance: learned.learnedKeyboardDistance,
      learnedKeyboardScore: learned.learnedKeyboardScore,
      learnedMargin: learned.learnedMargin,
      learnedModelSeparation: learned.learnedModelSeparation
    };
  }

  if (learned?.decision.state === "unknown") {
    return {
      rawState: "unknown",
      confidence: clamp01(1 - Math.abs(learned.learnedKeyboardScore - 0.5) * 2),
      distance,
      trackingScore,
      screenDistance: distance,
      ...sideGaze,
      ...keyboard,
      learnedScreenDistance: learned.learnedScreenDistance,
      learnedKeyboardDistance: learned.learnedKeyboardDistance,
      learnedKeyboardScore: learned.learnedKeyboardScore,
      learnedMargin: learned.learnedMargin,
      learnedModelSeparation: learned.learnedModelSeparation
    };
  }

  if (
    keyboard &&
    keyboard.keyboardSeparation >= MIN_KEYBOARD_SEPARATION &&
    ((keyboard.keyboardScore >= KEYBOARD_SCORE_AWAY_THRESHOLD &&
      keyboard.keyboardDistance < distance + KEYBOARD_DISTANCE_GRACE) ||
      keyboard.keyboardScore >= KEYBOARD_SCORE_STRONG_AWAY_THRESHOLD)
  ) {
    return {
      rawState: "away",
      confidence: clamp01(keyboard.keyboardScore),
      distance,
      trackingScore: 0,
      screenDistance: distance,
      ...sideGaze,
      ...keyboard,
      ...(learned
        ? {
            learnedScreenDistance: learned.learnedScreenDistance,
            learnedKeyboardDistance: learned.learnedKeyboardDistance,
            learnedKeyboardScore: learned.learnedKeyboardScore,
            learnedMargin: learned.learnedMargin,
            learnedModelSeparation: learned.learnedModelSeparation
          }
        : {})
    };
  }

  if (distance <= LOOKING_DISTANCE_THRESHOLD + DISTANCE_EPSILON) {
    return {
      rawState: "looking",
      confidence: clamp01(1 - distance / 1.4),
      distance,
      trackingScore,
      screenDistance: distance,
      ...sideGaze,
      ...keyboard,
      ...(learned
        ? {
            learnedScreenDistance: learned.learnedScreenDistance,
            learnedKeyboardDistance: learned.learnedKeyboardDistance,
            learnedKeyboardScore: learned.learnedKeyboardScore,
            learnedMargin: learned.learnedMargin,
            learnedModelSeparation: learned.learnedModelSeparation
          }
        : {})
    };
  }

  if (distance <= AWAY_DISTANCE_THRESHOLD + DISTANCE_EPSILON) {
    return {
      rawState: "unknown",
      confidence: clamp01(1 - Math.abs(distance - 1.325) / 0.65),
      distance,
      trackingScore,
      screenDistance: distance,
      ...sideGaze,
      ...keyboard,
      ...(learned
        ? {
            learnedScreenDistance: learned.learnedScreenDistance,
            learnedKeyboardDistance: learned.learnedKeyboardDistance,
            learnedKeyboardScore: learned.learnedKeyboardScore,
            learnedMargin: learned.learnedMargin,
            learnedModelSeparation: learned.learnedModelSeparation
          }
        : {})
    };
  }

  return {
    rawState: "away",
    confidence: clamp01((distance - 1.2) / 1.4),
    distance,
    trackingScore,
    screenDistance: distance,
    ...sideGaze,
    ...keyboard,
    ...(learned
      ? {
          learnedScreenDistance: learned.learnedScreenDistance,
          learnedKeyboardDistance: learned.learnedKeyboardDistance,
          learnedKeyboardScore: learned.learnedKeyboardScore,
          learnedMargin: learned.learnedMargin,
          learnedModelSeparation: learned.learnedModelSeparation
        }
      : {})
  };
}

export function trackingScoreForDistance(distance: number) {
  if (!Number.isFinite(distance)) {
    return 0;
  }

  return clamp01(1 - distance / AWAY_DISTANCE_THRESHOLD);
}

function weightedDistance(
  features: FrameFeatures,
  center: CalibrationProfile["center"],
  toleranceByKey: CalibrationProfile["tolerance"]
) {
  const weightTotal = FEATURE_KEYS.reduce((sum, key) => sum + FEATURE_WEIGHTS[key], 0);
  const weightedTotal = FEATURE_KEYS.reduce((sum, key) => {
    const tolerance = Math.max(toleranceByKey[key], MIN_TOLERANCE);
    const normalized = Math.abs(features[key] - center[key]) / tolerance;

    return sum + normalized ** 2 * FEATURE_WEIGHTS[key];
  }, 0);

  return Math.sqrt(weightedTotal / weightTotal);
}

function keyboardDiagnostics(
  features: FrameFeatures,
  profile: CalibrationProfile
) {
  if (!profile.keyboardCenter || !profile.keyboardTolerance) {
    return null;
  }

  if (
    FEATURE_KEYS.some(
      (key) =>
        !Number.isFinite(profile.keyboardCenter?.[key]) ||
        !Number.isFinite(profile.keyboardTolerance?.[key])
    )
  ) {
    return null;
  }

  const keyboardDistance = weightedDistance(
    features,
    profile.keyboardCenter,
    profile.keyboardTolerance
  );
  const keyboardSeparation =
    profile.keyboardSeparation ??
    keyboardSeparationFor(profile.center, profile.keyboardCenter, profile.tolerance);
  const keyboardQuality =
    profile.keyboardQuality ?? keyboardQualityForSeparation(keyboardSeparation);
  const keyboardScore = clamp(keyboardProjectionScore(features, profile), 0, 1);

  return {
    keyboardDistance,
    keyboardScore,
    keyboardSeparation,
    keyboardQuality
  };
}

function learnedDiagnostics(features: FrameFeatures, profile: CalibrationProfile) {
  const decision = classifyWithLearnedModel(features, profile.learnedModel);

  if (!decision) {
    return null;
  }

  return {
    decision,
    learnedScreenDistance: decision.screenDistance,
    learnedKeyboardDistance: decision.keyboardDistance,
    learnedKeyboardScore: decision.keyboardScore,
    learnedMargin: decision.margin,
    learnedModelSeparation: decision.modelSeparation
  };
}

function sideGazeDiagnostics(
  features: FrameFeatures,
  profile: CalibrationProfile
): { sideGazeScore: number; sideGazeDirection: "left" | "right" } {
  const sideKeys = [
    "yaw",
    "eyeHorizontal",
    "leftEyeHorizontal",
    "rightEyeHorizontal"
  ] as const;
  let signedTotal = 0;
  let weightedTotal = 0;
  let weightTotal = 0;

  for (const key of sideKeys) {
    const tolerance = Math.max(profile.tolerance[key], MIN_TOLERANCE);
    const normalized = (features[key] - profile.center[key]) / tolerance;
    const weight = FEATURE_WEIGHTS[key];

    signedTotal += normalized * weight;
    weightedTotal += normalized ** 2 * weight;
    weightTotal += weight;
  }

  return {
    sideGazeScore: Math.sqrt(weightedTotal / weightTotal),
    sideGazeDirection: signedTotal < 0 ? "left" : "right"
  };
}

function keyboardProjectionScore(features: FrameFeatures, profile: CalibrationProfile) {
  if (!profile.keyboardCenter || !profile.keyboardTolerance) {
    return 0;
  }

  let numerator = 0;
  let denominator = 0;

  for (const key of FEATURE_KEYS) {
    const tolerance = combinedTolerance(key, profile);
    const axis = (profile.keyboardCenter[key] - profile.center[key]) / tolerance;
    const value = (features[key] - profile.center[key]) / tolerance;
    const weight = FEATURE_WEIGHTS[key];

    numerator += value * axis * weight;
    denominator += axis ** 2 * weight;
  }

  if (denominator <= MIN_TOLERANCE) {
    return 0;
  }

  return numerator / denominator;
}

function keyboardSeparationFor(
  screenCenter: CalibrationProfile["center"],
  keyboardCenter: CalibrationProfile["center"],
  screenTolerance: CalibrationProfile["tolerance"]
) {
  const weightTotal = FEATURE_KEYS.reduce((sum, key) => sum + FEATURE_WEIGHTS[key], 0);
  const weightedTotal = FEATURE_KEYS.reduce((sum, key) => {
    const tolerance = Math.max(screenTolerance[key], MIN_TOLERANCE);
    const normalized = Math.abs(keyboardCenter[key] - screenCenter[key]) / tolerance;

    return sum + normalized ** 2 * FEATURE_WEIGHTS[key];
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

function combinedTolerance(key: FeatureKey, profile: CalibrationProfile) {
  return Math.max(
    profile.tolerance[key],
    profile.keyboardTolerance?.[key] ?? 0,
    MIN_TOLERANCE
  );
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
