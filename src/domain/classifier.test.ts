import { describe, expect, it } from "vitest";
import { classifyAttention } from "./classifier";
import type { CalibrationProfile, FrameFeatures } from "./types";

const profile: CalibrationProfile = {
  createdAtMs: 1000,
  minValidSamplesPerPoint: 12,
  points: ["top-left", "top-right", "bottom-right", "bottom-left", "center"],
  center: {
    pitch: 0.42,
    yaw: 0.05,
    eyeVertical: 0.5,
    eyeHorizontal: 0.5,
    faceCenterX: 0.5,
    faceCenterY: 0.45,
    faceScale: 0.62
  },
  tolerance: {
    pitch: 0.05,
    yaw: 0.05,
    eyeVertical: 0.04,
    eyeHorizontal: 0.04,
    faceCenterX: 0.1,
    faceCenterY: 0.1,
    faceScale: 0.08
  }
};

function frame(overrides: Partial<FrameFeatures> = {}): FrameFeatures {
  return {
    timestampMs: 2000,
    faceDetected: true,
    pitch: 0.42,
    yaw: 0.05,
    eyeVertical: 0.5,
    eyeHorizontal: 0.5,
    faceCenterX: 0.5,
    faceCenterY: 0.45,
    faceScale: 0.62,
    ...overrides
  };
}

describe("classifyAttention", () => {
  it("classifies calibrated-looking frames as looking", () => {
    expect(classifyAttention(frame(), profile).rawState).toBe("looking");
  });

  it("classifies strong downward posture as away", () => {
    const result = classifyAttention(frame({ pitch: 0.72, eyeVertical: 0.71 }), profile);
    expect(result.rawState).toBe("away");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("classifies borderline frames as unknown", () => {
    expect(classifyAttention(frame({ pitch: 0.49, eyeVertical: 0.56 }), profile).rawState).toBe(
      "unknown"
    );
  });

  it("classifies missing faces separately", () => {
    expect(classifyAttention(frame({ faceDetected: false }), profile)).toEqual({
      rawState: "face-missing",
      confidence: 1,
      distance: Number.POSITIVE_INFINITY
    });
  });

  it("returns unknown instead of a NaN distance for non-finite features", () => {
    expect(classifyAttention(frame({ pitch: Number.NaN }), profile)).toEqual({
      rawState: "unknown",
      confidence: 0,
      distance: Number.POSITIVE_INFINITY
    });
  });
});
