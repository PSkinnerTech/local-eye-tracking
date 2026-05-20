import { describe, expect, it } from "vitest";
import type { AttentionResult, FrameFeatures } from "./types";
import {
  BASELINE_TARGET_COUNT,
  EVALUATION_LABEL_METADATA,
  EVALUATION_LABELS,
  addEvaluationSample,
  createEvaluationExport,
  evaluationExportFilename,
  type EvaluationLabel,
  type EvaluationSample,
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

function samplesForLabel(
  label: EvaluationLabel,
  sampleCount: number,
  rawState: AttentionResult["rawState"] = "looking"
): EvaluationSample[] {
  let samples: EvaluationSample[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    samples = addEvaluationSample(samples, {
      label,
      timestampMs: 1_000 + index,
      features,
      attention: attention(rawState, 0.9),
      smootherSnapshot: {
        displayState: rawState === "looking" ? "green" : "red",
        rawState,
        awayDurationMs: rawState === "looking" ? 0 : 900
      },
      enforceTarget: false
    });
  }

  return samples;
}

describe("evaluation", () => {
  it("exports baseline target metadata for every evaluation label", () => {
    expect(BASELINE_TARGET_COUNT).toBe(20);
    expect(Object.keys(EVALUATION_LABEL_METADATA)).toEqual([...EVALUATION_LABELS]);

    expect(EVALUATION_LABEL_METADATA["screen-center"]).toMatchObject({
      displayName: "Screen center",
      role: "screen",
      targetCount: BASELINE_TARGET_COUNT
    });
    expect(EVALUATION_LABEL_METADATA.keyboard).toMatchObject({
      displayName: "Keyboard",
      role: "away",
      targetCount: BASELINE_TARGET_COUNT
    });
    expect(EVALUATION_LABEL_METADATA["low-light"].role).toBe("screen");

    for (const label of EVALUATION_LABELS) {
      expect(EVALUATION_LABEL_METADATA[label].instruction.length).toBeGreaterThan(8);
    }
  });

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

  it("does not add samples after a label reaches its baseline target", () => {
    const samples = samplesForLabel("keyboard", BASELINE_TARGET_COUNT, "away");

    const nextSamples = addEvaluationSample(samples, {
      label: "keyboard",
      timestampMs: 2_000,
      features,
      attention: attention("away", 0.2),
      smootherSnapshot: {
        displayState: "red",
        rawState: "away",
        awayDurationMs: 900
      }
    });

    expect(nextSamples).toBe(samples);
    expect(nextSamples).toHaveLength(BASELINE_TARGET_COUNT);
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

  it("summarizes baseline target progress and remaining samples", () => {
    const samples = [
      ...samplesForLabel("screen-center", 1),
      ...samplesForLabel("keyboard", BASELINE_TARGET_COUNT, "away"),
      ...samplesForLabel("off-left", BASELINE_TARGET_COUNT + 1, "away")
    ];

    const summary = summarizeEvaluation(samples);

    expect(summary.targetSamples).toBe(EVALUATION_LABELS.length * BASELINE_TARGET_COUNT);
    expect(summary.balancedSampleCount).toBe(41);
    expect(summary.extraSamples).toBe(1);
    expect(summary.completedLabels).toBe(2);
    expect(summary.remainingSamples).toBe(119);
    expect(summary.isComplete).toBe(false);
    expect(summary.labels["screen-center"]).toMatchObject({
      displayName: "Screen center",
      role: "screen",
      targetCount: BASELINE_TARGET_COUNT,
      remainingCount: 19,
      isComplete: false
    });
    expect(summary.labels.keyboard).toMatchObject({
      displayName: "Keyboard",
      role: "away",
      targetCount: BASELINE_TARGET_COUNT,
      remainingCount: 0,
      isComplete: true
    });
    expect(summary.labels["off-left"].remainingCount).toBe(0);
  });

  it("marks the overall summary complete when every label reaches its target", () => {
    const samples = EVALUATION_LABELS.flatMap((label) =>
      samplesForLabel(
        label,
        BASELINE_TARGET_COUNT,
        EVALUATION_LABEL_METADATA[label].role === "screen" ? "looking" : "away"
      )
    );

    const summary = summarizeEvaluation(samples);

    expect(summary.totalSamples).toBe(160);
    expect(summary.completedLabels).toBe(EVALUATION_LABELS.length);
    expect(summary.remainingSamples).toBe(0);
    expect(summary.isComplete).toBe(true);
    expect(Object.values(summary.labels).every((labelSummary) => labelSummary.isComplete)).toBe(
      true
    );
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

  it("formats a human-readable export filename with local time and sample count", () => {
    const createdAtMs = new Date(2026, 4, 20, 14, 32, 10).getTime();
    const payload = createEvaluationExport(samplesForLabel("screen-center", 160), createdAtMs);

    expect(evaluationExportFilename(payload)).toBe(
      "eyes-baseline-eval-2026-05-20T14-32-10-160samples.json"
    );
    expect(evaluationExportFilename(payload)).not.toContain(":");
  });
});
