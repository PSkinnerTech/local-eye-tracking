import { describe, expect, it } from "vitest";
import { classifyAttention } from "./classifier";
import type { CalibrationProfile, FrameFeatures } from "./types";

const PITCH_WEIGHT = 1.35;
const TOTAL_WEIGHT = 6.15;

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

function pitchForDistance(distance: number): number {
  const pitchDelta =
    profile.tolerance.pitch * distance * Math.sqrt(TOTAL_WEIGHT / PITCH_WEIGHT);

  return profile.center.pitch + pitchDelta;
}

function frameAtUniformDistance(distance: number): FrameFeatures {
  return frame({
    pitch: profile.center.pitch + profile.tolerance.pitch * distance,
    yaw: profile.center.yaw + profile.tolerance.yaw * distance,
    eyeVertical: profile.center.eyeVertical + profile.tolerance.eyeVertical * distance,
    eyeHorizontal: profile.center.eyeHorizontal + profile.tolerance.eyeHorizontal * distance,
    faceCenterX: profile.center.faceCenterX + profile.tolerance.faceCenterX * distance,
    faceCenterY: profile.center.faceCenterY + profile.tolerance.faceCenterY * distance,
    faceScale: profile.center.faceScale + profile.tolerance.faceScale * distance
  });
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

  it("classifies the away threshold boundary as unknown", () => {
    const result = classifyAttention(
      frame({ pitch: pitchForDistance(1.65 - 0.000000000001) }),
      profile
    );

    expect(result.rawState).toBe("unknown");
    expect(result.distance).toBeCloseTo(1.65, 10);
  });

  it("classifies just-over-away-threshold frames as away", () => {
    const result = classifyAttention(frameAtUniformDistance(1.6500000000005), profile);

    expect(result.rawState).toBe("away");
    expect(result.distance).toBeGreaterThan(1.65);
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
