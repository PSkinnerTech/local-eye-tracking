import { describe, expect, it } from "vitest";
import type { AttentionResult, FrameFeatures } from "./types";
import {
  addEvaluationSample,
  createEvaluationExport,
  summarizeEvaluation
} from "./evaluation";

const features: FrameFeatures = {
  timestampMs: 100,
  faceDetected: true,
  pitch: 0.2,
  yaw: 0.1,
  eyeVertical: 0.5,
  eyeHorizontal: 0.5,
  leftEyeVertical: 0.5,
  rightEyeVertical: 0.5,
  leftEyeHorizontal: 0.5,
  rightEyeHorizontal: 0.5,
  leftEyeOpenness: 0.04,
  rightEyeOpenness: 0.04,
  faceCenterX: 0.5,
  faceCenterY: 0.45,
  faceScale: 0.62
};

function attention(rawState: AttentionResult["rawState"], trackingScore: number): AttentionResult {
  return {
    rawState,
    confidence: 0.7,
    distance: 0.4,
    trackingScore,
    screenDistance: 0.4,
    keyboardDistance: 1.3,
    keyboardScore: 0.2,
    keyboardSeparation: 1.8,
    keyboardQuality: "strong"
  };
}

describe("evaluation", () => {
  it("adds labeled samples with feature and attention diagnostics", () => {
    const samples = addEvaluationSample([], {
      label: "screen-center",
      timestampMs: 150,
      features,
      attention: attention("looking", 0.95),
      smootherSnapshot: {
        displayState: "green",
        rawState: "looking",
        awayDurationMs: 0
      }
    });

    expect(samples).toHaveLength(1);
    expect(samples[0].label).toBe("screen-center");
    expect(samples[0].features?.eyeVertical).toBe(0.5);
    expect(samples[0].rawState).toBe("looking");
    expect(samples[0].displayState).toBe("green");
    expect(samples[0].trackingScore).toBe(0.95);
  });

  it("summarizes false-looking and false-away rates by label role", () => {
    const samples = [
      ...addEvaluationSample([], {
        label: "screen-center",
        timestampMs: 100,
        features,
        attention: attention("looking", 0.95),
        smootherSnapshot: { displayState: "green", rawState: "looking", awayDurationMs: 0 }
      }),
      ...addEvaluationSample([], {
        label: "screen-center",
        timestampMs: 120,
        features,
        attention: attention("away", 0.2),
        smootherSnapshot: { displayState: "red", rawState: "away", awayDurationMs: 900 }
      }),
      ...addEvaluationSample([], {
        label: "keyboard",
        timestampMs: 140,
        features,
        attention: attention("looking", 0.8),
        smootherSnapshot: { displayState: "green", rawState: "looking", awayDurationMs: 0 }
      }),
      ...addEvaluationSample([], {
        label: "keyboard",
        timestampMs: 160,
        features,
        attention: attention("away", 0.25),
        smootherSnapshot: { displayState: "red", rawState: "away", awayDurationMs: 900 }
      })
    ];

    const summary = summarizeEvaluation(samples);

    expect(summary.totalSamples).toBe(4);
    expect(summary.falseAwayRate).toBe(0.5);
    expect(summary.falseLookingRate).toBe(0.5);
    expect(summary.labels["screen-center"].lookingPercent).toBe(0.5);
    expect(summary.labels.keyboard.awayPercent).toBe(0.5);
  });

  it("creates an export payload with samples and summary metadata", () => {
    const samples = addEvaluationSample([], {
      label: "off-left",
      timestampMs: 200,
      features: null,
      attention: attention("face-missing", 0),
      smootherSnapshot: {
        displayState: "red",
        rawState: "face-missing",
        awayDurationMs: 900
      }
    });

    const payload = createEvaluationExport(samples, 300);

    expect(payload.version).toBe(1);
    expect(payload.createdAtMs).toBe(300);
    expect(payload.samples[0].features).toBeNull();
    expect(payload.summary.totalSamples).toBe(1);
  });
});
