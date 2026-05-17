import {
  FEATURE_KEYS,
  type AttentionResult,
  type CalibrationProfile,
  type FeatureKey,
  type FrameFeatures
} from "./types";

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
      distance: Number.POSITIVE_INFINITY
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
      distance: Number.POSITIVE_INFINITY
    };
  }

  const movedKeys = FEATURE_KEYS.filter((key) => features[key] !== profile.center[key]);
  const distanceKeys = movedKeys.length > 0 ? movedKeys : FEATURE_KEYS;
  const weightTotal = distanceKeys.reduce((sum, key) => sum + FEATURE_WEIGHTS[key], 0);
  const weightedDistance = distanceKeys.reduce((sum, key) => {
    const tolerance = Math.max(profile.tolerance[key], MIN_TOLERANCE);
    const normalized = Math.abs(features[key] - profile.center[key]) / tolerance;

    return sum + normalized ** 2 * FEATURE_WEIGHTS[key];
  }, 0);
  const distance = Math.sqrt(weightedDistance / weightTotal);

  if (distance <= 1) {
    return {
      rawState: "looking",
      confidence: clamp01(1 - distance / 1.4),
      distance
    };
  }

  if (distance <= 1.65) {
    return {
      rawState: "unknown",
      confidence: clamp01(1 - Math.abs(distance - 1.325) / 0.65),
      distance
    };
  }

  return {
    rawState: "away",
    confidence: clamp01((distance - 1.2) / 1.4),
    distance
  };
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
