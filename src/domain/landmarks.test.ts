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
    469: { x: 0.405, y: 0.36, z: 0 },
    470: { x: 0.39, y: 0.345, z: 0 },
    471: { x: 0.375, y: 0.36, z: 0 },
    472: { x: 0.39, y: 0.375, z: 0 },
    473: { x: 0.61, y: 0.36, z: 0 },
    474: { x: 0.625, y: 0.36, z: 0 },
    475: { x: 0.61, y: 0.345, z: 0 },
    476: { x: 0.595, y: 0.36, z: 0 },
    477: { x: 0.61, y: 0.375, z: 0 },
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
    expect(features?.leftEyeVertical).toBeCloseTo(0.5, 1);
    expect(features?.rightEyeVertical).toBeCloseTo(0.5, 1);
    expect(features?.leftEyeHorizontal).toBeCloseTo(0.5, 1);
    expect(features?.rightEyeHorizontal).toBeCloseTo(0.5, 1);
    expect(features?.leftEyeOpenness).toBeCloseTo(0.06, 3);
    expect(features?.rightEyeOpenness).toBeCloseTo(0.06, 3);
  });

  it("preserves landmark-derived features when optional MediaPipe outputs are missing", () => {
    const withoutOutputs = extractFrameFeatures(landmarks(), 1234);
    const withEmptyOutputs = extractFrameFeatures(landmarks(), 1234, {});

    expect(withEmptyOutputs).toEqual(withoutOutputs);
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

  it("captures eye-only downward movement without changing head pitch", () => {
    const neutral = extractFrameFeatures(landmarks(), 1000);
    const eyeOnlyDown = extractFrameFeatures(
      landmarks({
        468: { x: 0.39, y: 0.385, z: 0 },
        473: { x: 0.61, y: 0.385, z: 0 }
      }),
      1016
    );

    expect(neutral).not.toBeNull();
    expect(eyeOnlyDown).not.toBeNull();
    expect(eyeOnlyDown!.pitch).toBeCloseTo(neutral!.pitch, 6);
    expect(eyeOnlyDown!.leftEyeVertical).toBeGreaterThan(neutral!.leftEyeVertical);
    expect(eyeOnlyDown!.rightEyeVertical).toBeGreaterThan(neutral!.rightEyeVertical);
  });

  it("copies eye blendshape scores to optional diagnostics", () => {
    const features = extractFrameFeatures(landmarks(), 1234, {
      blendshapes: {
        categories: [
          { categoryName: "eyeLookDownLeft", score: 0.11 },
          { categoryName: "eyeLookDownRight", score: 0.12 },
          { categoryName: "eyeBlinkLeft", score: 0.21 },
          { categoryName: "eyeBlinkRight", score: 0.22 },
          { categoryName: "eyeLookInLeft", score: 0.31 },
          { categoryName: "eyeLookInRight", score: 0.32 },
          { categoryName: "eyeLookOutLeft", score: 0.41 },
          { categoryName: "eyeLookOutRight", score: 0.42 }
        ]
      }
    });

    expect(features).not.toBeNull();
    expect(features!.eyeLookDownLeft).toBe(0.11);
    expect(features!.eyeLookDownRight).toBe(0.12);
    expect(features!.eyeBlinkLeft).toBe(0.21);
    expect(features!.eyeBlinkRight).toBe(0.22);
    expect(features!.eyeLookInLeft).toBe(0.31);
    expect(features!.eyeLookInRight).toBe(0.32);
    expect(features!.eyeLookOutLeft).toBe(0.41);
    expect(features!.eyeLookOutRight).toBe(0.42);
  });

  it("uses a valid facial transformation matrix for head pose diagnostics", () => {
    const fallback = extractFrameFeatures(landmarks(), 1234);
    const features = extractFrameFeatures(landmarks(), 1234, {
      facialTransformationMatrix: {
        rows: 4,
        columns: 4,
        data: [
          0.879923176, -0.435732131, -0.189400933, 0,
          0.372025552, 0.879838033, -0.295773602, 0,
          0.295520207, 0.189796061, 0.936293364, 0,
          0, 0, 0, 1
        ]
      }
    });

    expect(fallback).not.toBeNull();
    expect(features).not.toBeNull();
    expect(features!.pitch).not.toBeCloseTo(fallback!.pitch, 6);
    expect(features!.pitch).toBeCloseTo(0.2, 6);
    expect(features!.yaw).toBeCloseTo(-0.3, 6);
    expect(features!.matrixPitch).toBeCloseTo(0.2, 6);
    expect(features!.matrixYaw).toBeCloseTo(-0.3, 6);
    expect(features!.matrixRoll).toBeCloseTo(0.4, 6);
  });
});
