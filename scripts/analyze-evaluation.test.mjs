import { describe, expect, it } from "vitest";

import {
  EVALUATION_LABEL_METADATA,
  analyzeEvaluationPayloads,
  formatEvaluationAnalysis,
  validateEvaluationPayload
} from "./lib/evaluation-analysis.mjs";

function sample(label, rawState, trackingScore, keyboardScore) {
  return {
    id: `${label}-${rawState}-${trackingScore}`,
    timestampMs: 1_000,
    label,
    rawState,
    displayState: rawState === "looking" ? "green" : "red",
    awayDurationMs: rawState === "looking" ? 0 : 900,
    trackingScore,
    ...(keyboardScore === undefined ? {} : { keyboardScore })
  };
}

describe("evaluation export analysis", () => {
  it("computes false-looking and false-away rates from label role metadata", () => {
    const samples = [
      sample("keyboard", "looking", 0.91, 0.82),
      sample("off-left", "away", 0.25, 0.67),
      sample("off-right", "looking", 0.88, 0.74),
      sample("screen-center", "away", 0.31, 0.2),
      sample("screen-bottom", "looking", 0.94, 0.12),
      sample("lean-left", "unknown", 0.62),
      sample("lean-right", "face-missing", 0)
    ];
    const analysis = analyzeEvaluationPayloads([
      {
        version: 1,
        samples
      }
    ]);
    const expectedAwaySamples = samples.filter(
      (row) => EVALUATION_LABEL_METADATA[row.label].role === "away"
    );
    const expectedScreenSamples = samples.filter(
      (row) => EVALUATION_LABEL_METADATA[row.label].role === "screen"
    );

    expect(analysis.totalSamples).toBe(7);
    expect(analysis.fileCount).toBe(1);
    expect(analysis.falseLookingDenominator).toBe(expectedAwaySamples.length);
    expect(analysis.falseLookingRate).toBe(2 / 3);
    expect(analysis.falseAwayDenominator).toBe(expectedScreenSamples.length);
    expect(analysis.falseAwayRate).toBe(1 / 4);
    expect(analysis.labels.keyboard).toMatchObject({
      displayName: "Keyboard",
      role: "away",
      targetCount: 20,
      remainingCount: 19,
      isComplete: false,
      count: 1,
      lookingPercent: 1,
      medianTrackingScore: 0.91,
      medianKeyboardScore: 0.82
    });
    expect(analysis.labels["lean-left"].unknownPercent).toBe(1);
    expect(analysis.labels["lean-right"].faceMissingPercent).toBe(1);
  });

  it("rejects invalid payloads", () => {
    expect(() => validateEvaluationPayload({ version: 2, samples: [] }, "bad.json")).toThrow(
      /bad\.json.*version === 1/
    );
    expect(() => validateEvaluationPayload({ version: 1, samples: {} }, "bad.json")).toThrow(
      /bad\.json.*samples array/
    );
  });

  it("formats output with display names and target progress", () => {
    const analysis = analyzeEvaluationPayloads(
      [
        {
          version: 1,
          samples: [
            sample("keyboard", "looking", 0.91, 0.82),
            sample("screen-center", "away", 0.31, 0.2)
          ]
        },
        {
          version: 1,
          samples: [sample("screen-center", "looking", 0.95, 0.1)]
        }
      ],
      2
    );

    const output = formatEvaluationAnalysis(analysis);

    expect(output).toContain("Files: 2");
    expect(output).toContain("Total samples: 3/160 target (157 remaining)");
    expect(output).toContain("False-looking rate: 100.0%");
    expect(output).toContain("False-away rate: 50.0%");
    expect(output).toContain("Label");
    expect(output).toContain("Target");
    expect(output).toContain("Remaining");
    expect(output).toContain("Keyboard");
    expect(output).toContain("Screen center");
    expect(output).not.toMatch(/^keyboard\s+/m);
    expect(output).not.toMatch(/^screen-center\s+/m);
    expect(output).toContain("Median tracking");
    expect(output).toContain("Median keyboard");
  });
});
