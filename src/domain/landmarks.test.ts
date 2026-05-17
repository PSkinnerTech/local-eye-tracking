import { describe, expect, it } from "vitest";
import { extractFrameFeatures, type NormalizedLandmark } from "./landmarks";

function landmarks(overrides: Partial<Record<number, NormalizedLandmark>> = {}) {
  const base: NormalizedLandmark[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0
  }));
  const required: Partial<Record<number, NormalizedLandmark>> = {
    1: { x: 0.5, y: 0.42, z: -0.04 },
    33: { x: 0.34, y: 0.36, z: 0 },
    133: { x: 0.44, y: 0.36, z: 0 },
    145: { x: 0.39, y: 0.39, z: 0 },
    152: { x: 0.5, y: 0.7, z: 0 },
    159: { x: 0.39, y: 0.33, z: 0 },
    234: { x: 0.22, y: 0.5, z: 0 },
    263: { x: 0.66, y: 0.36, z: 0 },
    362: { x: 0.56, y: 0.36, z: 0 },
    374: { x: 0.61, y: 0.39, z: 0 },
    386: { x: 0.61, y: 0.33, z: 0 },
    454: { x: 0.78, y: 0.5, z: 0 },
    468: { x: 0.39, y: 0.36, z: 0 },
    473: { x: 0.61, y: 0.36, z: 0 },
    ...overrides
  };

  for (const [index, landmark] of Object.entries(required)) {
    if (landmark) {
      base[Number(index)] = landmark;
    }
  }
  return base;
}

describe("extractFrameFeatures", () => {
  it("returns normalized frame features from face landmarks", () => {
    const features = extractFrameFeatures(landmarks(), 1234);

    expect(features?.faceDetected).toBe(true);
    expect(features?.timestampMs).toBe(1234);
    expect(features?.faceCenterX).toBeCloseTo(0.5, 2);
    expect(features?.faceScale).toBeGreaterThan(0.3);
    expect(features?.eyeVertical).toBeCloseTo(0.5, 1);
  });

  it("returns null when required landmarks are missing", () => {
    expect(extractFrameFeatures([], 1234)).toBeNull();
  });

  it("moves pitch and eyeVertical when the face looks down", () => {
    const neutral = extractFrameFeatures(landmarks(), 1000);
    const down = extractFrameFeatures(
      landmarks({
        1: { x: 0.5, y: 0.5, z: -0.04 },
        468: { x: 0.39, y: 0.385, z: 0 },
        473: { x: 0.61, y: 0.385, z: 0 }
      }),
      1016
    );

    expect(neutral).not.toBeNull();
    expect(down).not.toBeNull();
    expect(down!.pitch).toBeGreaterThan(neutral!.pitch);
    expect(down!.eyeVertical).toBeGreaterThan(neutral!.eyeVertical);
  });
});
