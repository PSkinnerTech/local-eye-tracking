import { describe, expect, it } from "vitest";
import {
  LEARNED_FEATURE_KEYS,
  buildLearnedAttentionModel,
  classifyWithLearnedModel
} from "./learnedClassifier";
import type { FrameFeatures, LearnedAttentionModel } from "./types";

function frame(overrides: Partial<FrameFeatures> = {}): FrameFeatures {
  return {
    timestampMs: 1_000,
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

function screenSamples(): FrameFeatures[] {
  return Array.from({ length: 16 }, (_, index) =>
    frame({
      timestampMs: 1_000 + index,
      eyeVertical: 0.5 + index * 0.0005,
      leftEyeVertical: 0.5 + index * 0.0005,
      rightEyeVertical: 0.5 + index * 0.0005,
      faceCenterX: 0.45 + index * 0.01,
      faceScale: 0.58 + index * 0.01
    })
  );
}

function keyboardSamples(): FrameFeatures[] {
  return Array.from({ length: 16 }, (_, index) =>
    frame({
      timestampMs: 2_000 + index,
      eyeVertical: 0.68 + index * 0.0005,
      leftEyeVertical: 0.68 + index * 0.0005,
      rightEyeVertical: 0.68 + index * 0.0005,
      faceCenterX: 0.45 + index * 0.01,
      faceScale: 0.58 + index * 0.01
    })
  );
}

describe("learnedClassifier", () => {
  it("uses gaze-attention features and excludes face placement features", () => {
    expect(LEARNED_FEATURE_KEYS).toContain("eyeVertical");
    expect(LEARNED_FEATURE_KEYS).toContain("leftEyeVertical");
    expect(LEARNED_FEATURE_KEYS).not.toContain("faceCenterX");
    expect(LEARNED_FEATURE_KEYS).not.toContain("faceCenterY");
    expect(LEARNED_FEATURE_KEYS).not.toContain("faceScale");
  });

  it("builds a learned screen-vs-keyboard model from calibration samples", () => {
    const model = buildLearnedAttentionModel(screenSamples(), keyboardSamples());

    expect(model).not.toBeNull();
    expect(model?.version).toBe(1);
    expect(model?.featureKeys).toEqual([...LEARNED_FEATURE_KEYS]);
    expect(model?.keyboardSeparation).toBeGreaterThan(0.75);
    expect(model?.screenRadius).toBeGreaterThanOrEqual(0);
    expect(model?.keyboardRadius).toBeGreaterThanOrEqual(0);
  });

  it("returns null when screen calibration samples are empty", () => {
    expect(buildLearnedAttentionModel([], keyboardSamples())).toBeNull();
  });

  it("returns null when all calibration samples are invalid or face-missing", () => {
    const invalidSamples = screenSamples().map((sample, index) =>
      frame({
        ...sample,
        faceDetected: false,
        eyeVertical: index % 2 === 0 ? Number.NaN : sample.eyeVertical
      })
    );

    expect(buildLearnedAttentionModel(invalidSamples, keyboardSamples())).toBeNull();
    expect(buildLearnedAttentionModel(screenSamples(), invalidSamples)).toBeNull();
  });

  it("builds weak learned models for diagnostics but does not trust them for classification", () => {
    const weakModel = buildLearnedAttentionModel(screenSamples(), screenSamples());

    expect(weakModel).not.toBeNull();
    expect(weakModel?.keyboardSeparation).toBeLessThan(0.75);
    expect(classifyWithLearnedModel(frame(), weakModel!)).toBeNull();
  });

  it("classifies keyboard-like eye-only glances as keyboard", () => {
    const model = buildLearnedAttentionModel(screenSamples(), keyboardSamples());
    expect(model).not.toBeNull();

    const decision = classifyWithLearnedModel(
      frame({
        eyeVertical: 0.675,
        leftEyeVertical: 0.675,
        rightEyeVertical: 0.675,
        faceCenterX: 0.9,
        faceScale: 0.9
      }),
      model!
    );

    expect(decision?.state).toBe("keyboard");
    expect(decision?.keyboardScore).toBeGreaterThan(0.6);
    expect(decision?.margin).toBeGreaterThan(0.15);
  });

  it("classifies screen-like frames as screen despite face placement changes", () => {
    const model = buildLearnedAttentionModel(screenSamples(), keyboardSamples());
    expect(model).not.toBeNull();

    const decision = classifyWithLearnedModel(
      frame({
        eyeVertical: 0.51,
        leftEyeVertical: 0.51,
        rightEyeVertical: 0.51,
        faceCenterX: 0.92,
        faceCenterY: 0.88,
        faceScale: 0.9
      }),
      model!
    );

    expect(decision?.state).toBe("screen");
    expect(decision?.keyboardScore).toBeLessThan(0.4);
    expect(decision?.margin).toBeLessThan(-0.15);
  });

  it("returns unknown for ambiguous frames between screen and keyboard", () => {
    const model = buildLearnedAttentionModel(screenSamples(), keyboardSamples());
    expect(model).not.toBeNull();

    const decision = classifyWithLearnedModel(
      frame({
        eyeVertical: 0.59,
        leftEyeVertical: 0.59,
        rightEyeVertical: 0.59
      }),
      model!
    );

    expect(decision?.state).toBe("unknown");
    expect(Math.abs(decision?.margin ?? 99)).toBeLessThan(0.2);
  });

  it("returns null when required frame values are invalid", () => {
    const strongModel = buildLearnedAttentionModel(screenSamples(), keyboardSamples());
    expect(strongModel).not.toBeNull();
    expect(classifyWithLearnedModel(frame({ eyeVertical: Number.NaN }), strongModel!)).toBeNull();
  });

  it("returns null for malformed runtime models without throwing", () => {
    const malformedModel = {
      version: 1,
      featureKeys: [...LEARNED_FEATURE_KEYS],
      keyboardSeparation: 2
    } as LearnedAttentionModel;

    expect(() => classifyWithLearnedModel(frame(), malformedModel)).not.toThrow();
    expect(classifyWithLearnedModel(frame(), malformedModel)).toBeNull();
  });

  it("rejects models that include face placement feature keys", () => {
    const model = buildLearnedAttentionModel(screenSamples(), keyboardSamples());
    expect(model).not.toBeNull();

    const facePlacementModel = {
      ...model!,
      featureKeys: [...model!.featureKeys, "faceCenterX"]
    } as LearnedAttentionModel;

    expect(classifyWithLearnedModel(frame(), facePlacementModel)).toBeNull();
  });

  it("rejects forged high separation when learned centroids are weak", () => {
    const model = buildLearnedAttentionModel(screenSamples(), keyboardSamples());
    expect(model).not.toBeNull();

    const forgedModel = {
      ...model!,
      keyboardCenter: model!.screenCenter,
      keyboardSeparation: 999
    };

    expect(classifyWithLearnedModel(frame(), forgedModel)).toBeNull();
  });

  it("rejects duplicate learned model feature keys", () => {
    const model = buildLearnedAttentionModel(screenSamples(), keyboardSamples());
    expect(model).not.toBeNull();

    const duplicateFeatureModel = {
      ...model!,
      featureKeys: [...model!.featureKeys, model!.featureKeys[0]]
    };

    expect(classifyWithLearnedModel(frame(), duplicateFeatureModel)).toBeNull();
  });

  it("rejects missing learned model feature keys", () => {
    const model = buildLearnedAttentionModel(screenSamples(), keyboardSamples());
    expect(model).not.toBeNull();

    const missingFeatureModel = {
      ...model!,
      featureKeys: model!.featureKeys.slice(1)
    };

    expect(classifyWithLearnedModel(frame(), missingFeatureModel)).toBeNull();
  });
});
