import {
  FEATURE_KEYS,
  type AttentionResult,
  type CalibrationProfile,
  type FeatureKey,
  type FrameFeatures
} from "./types";

export const LOOKING_DISTANCE_THRESHOLD = 1;
export const AWAY_DISTANCE_THRESHOLD = 1.65;
export const TRACKING_SCORE_THRESHOLD = 0.35;
const KEYBOARD_PROFILE_MARGIN = 0.15;

const FEATURE_WEIGHTS: Record<FeatureKey, number> = {
  pitch: 1.35,
  yaw: 1.1,
  eyeVertical: 1.25,
  eyeHorizontal: 0.9,
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

  const trackingScore = trackingScoreForDistance(distance);
  const keyboardDistance =
    profile.keyboardCenter && profile.keyboardTolerance
      ? weightedDistance(features, profile.keyboardCenter, profile.keyboardTolerance)
      : null;

  if (
    keyboardDistance !== null &&
    keyboardDistance + KEYBOARD_PROFILE_MARGIN < distance
  ) {
    return {
      rawState: "away",
      confidence: clamp01((distance - keyboardDistance) / 1.4),
      distance,
      trackingScore: 0
    };
  }

  if (distance <= LOOKING_DISTANCE_THRESHOLD) {
    return {
      rawState: "looking",
      confidence: clamp01(1 - distance / 1.4),
      distance,
      trackingScore
    };
  }

  if (distance <= AWAY_DISTANCE_THRESHOLD) {
    return {
      rawState: "unknown",
      confidence: clamp01(1 - Math.abs(distance - 1.325) / 0.65),
      distance,
      trackingScore
    };
  }

  return {
    rawState: "away",
    confidence: clamp01((distance - 1.2) / 1.4),
    distance,
    trackingScore
  };
}

export function rawStateForTrackingThreshold(
  attention: AttentionResult,
  threshold = TRACKING_SCORE_THRESHOLD
) {
  if (attention.rawState === "face-missing") {
    return "face-missing";
  }

  return attention.trackingScore < threshold ? "away" : "looking";
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

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
