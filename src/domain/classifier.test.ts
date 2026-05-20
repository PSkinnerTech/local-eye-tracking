import { describe, expect, it } from "vitest";
import { classifyAttention } from "./classifier";
import type { CalibrationProfile, FrameFeatures } from "./types";

const PITCH_WEIGHT = 1.35;
const TOTAL_WEIGHT = 11.35;

const profile: CalibrationProfile = {
  createdAtMs: 1000,
  minValidSamplesPerPoint: 12,
  points: ["top-left", "top-right", "bottom-right", "bottom-left", "center"],
  center: {
    pitch: 0.42,
    yaw: 0.05,
    eyeVertical: 0.5,
    eyeHorizontal: 0.5,
    leftEyeVertical: 0.5,
    rightEyeVertical: 0.5,
    leftEyeHorizontal: 0.5,
    rightEyeHorizontal: 0.5,
    leftEyeOpenness: 0.06,
    rightEyeOpenness: 0.06,
    faceCenterX: 0.5,
    faceCenterY: 0.45,
    faceScale: 0.62
  },
  tolerance: {
    pitch: 0.05,
    yaw: 0.05,
    eyeVertical: 0.04,
    eyeHorizontal: 0.04,
    leftEyeVertical: 0.04,
    rightEyeVertical: 0.04,
    leftEyeHorizontal: 0.04,
    rightEyeHorizontal: 0.04,
    leftEyeOpenness: 0.015,
    rightEyeOpenness: 0.015,
    faceCenterX: 0.1,
    faceCenterY: 0.1,
    faceScale: 0.08
  }
};

const exactBoundaryProfile: CalibrationProfile = {
  ...profile,
  center: {
    pitch: 0,
    yaw: 0,
    eyeVertical: 0,
    eyeHorizontal: 0,
    leftEyeVertical: 0,
    rightEyeVertical: 0,
    leftEyeHorizontal: 0,
    rightEyeHorizontal: 0,
    leftEyeOpenness: 0,
    rightEyeOpenness: 0,
    faceCenterX: 0,
    faceCenterY: 0,
    faceScale: 0
  },
  tolerance: {
    pitch: 1,
    yaw: 1,
    eyeVertical: 1,
    eyeHorizontal: 1,
    leftEyeVertical: 1,
    rightEyeVertical: 1,
    leftEyeHorizontal: 1,
    rightEyeHorizontal: 1,
    leftEyeOpenness: 1,
    rightEyeOpenness: 1,
    faceCenterX: 1,
    faceCenterY: 1,
    faceScale: 1
  }
};

const keyboardProfile = {
  ...profile,
  keyboardCenter: {
    ...profile.center,
    eyeVertical: 0.64,
    leftEyeVertical: 0.64,
    rightEyeVertical: 0.64
  },
  keyboardTolerance: {
    ...profile.tolerance,
    eyeVertical: 0.035,
    leftEyeVertical: 0.035,
    rightEyeVertical: 0.035
  },
  keyboardSeparation: 1.8,
  keyboardQuality: "strong"
} as CalibrationProfile;

const weakKeyboardProfile = {
  ...profile,
  keyboardCenter: {
    ...profile.center,
    eyeVertical: 0.52,
    leftEyeVertical: 0.52,
    rightEyeVertical: 0.52
  },
  keyboardTolerance: profile.tolerance,
  keyboardSeparation: 0.4,
  keyboardQuality: "weak"
} as CalibrationProfile;

function frame(overrides: Partial<FrameFeatures> = {}): FrameFeatures {
  return {
    timestampMs: 2000,
    faceDetected: true,
    pitch: 0.42,
    yaw: 0.05,
    eyeVertical: 0.5,
    eyeHorizontal: 0.5,
    leftEyeVertical: 0.5,
    rightEyeVertical: 0.5,
    leftEyeHorizontal: 0.5,
    rightEyeHorizontal: 0.5,
    leftEyeOpenness: 0.06,
    rightEyeOpenness: 0.06,
    faceCenterX: 0.5,
    faceCenterY: 0.45,
    faceScale: 0.62,
    ...overrides
  };
}

function pitchForDistance(distance: number): number {
  const pitchDelta =
    profile.tolerance.pitch * distance * Math.sqrt(TOTAL_WEIGHT / PITCH_WEIGHT);

  return profile.center.pitch + pitchDelta;
}

function frameAtUniformDistance(
  distance: number,
  calibrationProfile = profile
): FrameFeatures {
  return frame({
    pitch:
      calibrationProfile.center.pitch + calibrationProfile.tolerance.pitch * distance,
    yaw: calibrationProfile.center.yaw + calibrationProfile.tolerance.yaw * distance,
    eyeVertical:
      calibrationProfile.center.eyeVertical +
      calibrationProfile.tolerance.eyeVertical * distance,
    eyeHorizontal:
      calibrationProfile.center.eyeHorizontal +
      calibrationProfile.tolerance.eyeHorizontal * distance,
    leftEyeVertical:
      calibrationProfile.center.leftEyeVertical +
      calibrationProfile.tolerance.leftEyeVertical * distance,
    rightEyeVertical:
      calibrationProfile.center.rightEyeVertical +
      calibrationProfile.tolerance.rightEyeVertical * distance,
    leftEyeHorizontal:
      calibrationProfile.center.leftEyeHorizontal +
      calibrationProfile.tolerance.leftEyeHorizontal * distance,
    rightEyeHorizontal:
      calibrationProfile.center.rightEyeHorizontal +
      calibrationProfile.tolerance.rightEyeHorizontal * distance,
    leftEyeOpenness:
      calibrationProfile.center.leftEyeOpenness +
      calibrationProfile.tolerance.leftEyeOpenness * distance,
    rightEyeOpenness:
      calibrationProfile.center.rightEyeOpenness +
      calibrationProfile.tolerance.rightEyeOpenness * distance,
    faceCenterX:
      calibrationProfile.center.faceCenterX +
      calibrationProfile.tolerance.faceCenterX * distance,
    faceCenterY:
      calibrationProfile.center.faceCenterY +
      calibrationProfile.tolerance.faceCenterY * distance,
    faceScale:
      calibrationProfile.center.faceScale +
      calibrationProfile.tolerance.faceScale * distance
  });
}

describe("classifyAttention", () => {
  it("classifies calibrated-looking frames as looking", () => {
    const result = classifyAttention(frame(), profile);

    expect(result.rawState).toBe("looking");
    expect(result.trackingScore).toBe(1);
  });

  it("classifies strong downward posture as away", () => {
    const result = classifyAttention(frame({ pitch: 0.72, eyeVertical: 0.71 }), profile);
    expect(result.rawState).toBe("away");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("classifies borderline frames as unknown", () => {
    expect(classifyAttention(frame({ pitch: pitchForDistance(1.2) }), profile).rawState).toBe(
      "unknown"
    );
  });

  it("uses all feature weights at the looking threshold boundary", () => {
    const result = classifyAttention(frameAtUniformDistance(1), profile);

    expect(result.rawState).toBe("looking");
    expect(result.distance).toBeCloseTo(1, 10);
  });

  it("classifies just-over-threshold frames as unknown", () => {
    const result = classifyAttention(frame({ pitch: pitchForDistance(1.01) }), profile);

    expect(result.rawState).toBe("unknown");
    expect(result.distance).toBeCloseTo(1.01, 10);
  });

  it("classifies frames above the away threshold as away", () => {
    const result = classifyAttention(frame({ pitch: pitchForDistance(1.66) }), profile);

    expect(result.rawState).toBe("away");
    expect(result.distance).toBeCloseTo(1.66, 10);
  });

  it("classifies the exact away threshold boundary as unknown", () => {
    const result = classifyAttention(
      frameAtUniformDistance(1.65, exactBoundaryProfile),
      exactBoundaryProfile
    );

    expect(result.rawState).toBe("unknown");
    expect(result.distance).toBeCloseTo(1.65, 10);
  });

  it("classifies just-over-away-threshold frames as away", () => {
    const result = classifyAttention(frameAtUniformDistance(1.6500000000005), profile);

    expect(result.rawState).toBe("away");
    expect(result.distance).toBeGreaterThan(1.65);
  });

  it("classifies eye-only keyboard glances as away when they match the keyboard profile", () => {
    const result = classifyAttention(
      frame({
        pitch: profile.center.pitch,
        yaw: profile.center.yaw,
        eyeVertical: 0.635,
        leftEyeVertical: 0.635,
        rightEyeVertical: 0.635,
        eyeHorizontal: profile.center.eyeHorizontal,
        leftEyeHorizontal: profile.center.leftEyeHorizontal,
        rightEyeHorizontal: profile.center.rightEyeHorizontal,
        leftEyeOpenness: profile.center.leftEyeOpenness,
        rightEyeOpenness: profile.center.rightEyeOpenness,
        faceCenterX: profile.center.faceCenterX,
        faceCenterY: profile.center.faceCenterY,
        faceScale: profile.center.faceScale
      }),
      keyboardProfile
    );

    expect(result.rawState).toBe("away");
    expect(result.trackingScore).toBe(0);
    expect(result.keyboardScore).toBeGreaterThan(0.55);
    expect(result.keyboardSeparation).toBeGreaterThan(1.35);
    expect(result.keyboardQuality).toBe("strong");
  });

  it("keeps bottom-screen-like eye movement looking when it is below the keyboard projection threshold", () => {
    const result = classifyAttention(
      frame({
        eyeVertical: 0.55,
        leftEyeVertical: 0.55,
        rightEyeVertical: 0.55
      }),
      keyboardProfile
    );

    expect(result.rawState).toBe("looking");
    expect(result.keyboardScore).toBeLessThan(0.55);
  });

  it("does not trust keyboard projection when calibration separation is weak", () => {
    const result = classifyAttention(
      frame({
        eyeVertical: 0.52,
        leftEyeVertical: 0.52,
        rightEyeVertical: 0.52
      }),
      weakKeyboardProfile
    );

    expect(result.rawState).toBe("looking");
    expect(result.keyboardQuality).toBe("weak");
  });

  it("keeps distance stable when unrelated features have tiny jitter", () => {
    const steady = classifyAttention(frame({ pitch: pitchForDistance(1.2) }), profile);
    const jittered = classifyAttention(
      frame({ pitch: pitchForDistance(1.2), yaw: profile.center.yaw + 0.000001 }),
      profile
    );

    expect(jittered.rawState).toBe(steady.rawState);
    expect(jittered.distance).toBeCloseTo(steady.distance, 8);
  });

  it("classifies missing faces separately", () => {
    expect(classifyAttention(frame({ faceDetected: false }), profile)).toEqual({
      rawState: "face-missing",
      confidence: 1,
      distance: Number.POSITIVE_INFINITY,
      trackingScore: 0
    });
  });

  it("returns unknown instead of a NaN distance for non-finite features", () => {
    expect(classifyAttention(frame({ pitch: Number.NaN }), profile)).toEqual({
      rawState: "unknown",
      confidence: 0,
      distance: Number.POSITIVE_INFINITY,
      trackingScore: 0
    });
  });
});
