import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  BASELINE_TARGET_COUNT,
  EVALUATION_LABEL_METADATA,
  EVALUATION_LABELS,
  type EvaluationLabel,
  type EvaluationSample,
  type EvaluationSummary,
  type EvaluationSummaryByLabel
} from "../domain/evaluation";
import { EvaluationPanel } from "./EvaluationPanel";

function labelSummary(label: EvaluationLabel, sampleCount = 0): EvaluationSummaryByLabel {
  const metadata = EVALUATION_LABEL_METADATA[label];
  const remainingCount = Math.max(0, metadata.targetCount - sampleCount);

  return {
    displayName: metadata.displayName,
    role: metadata.role,
    targetCount: metadata.targetCount,
    remainingCount,
    isComplete: remainingCount === 0,
    sampleCount,
    lookingPercent: 0,
    unknownPercent: 0,
    awayPercent: 0,
    faceMissingPercent: 0,
    medianTrackingScore: null,
    medianSideGazeScore: null,
    medianKeyboardScore: null,
    medianLearnedKeyboardScore: null,
    medianLearnedModelSeparation: null
  };
}

function summary(counts: Partial<Record<EvaluationLabel, number>> = {}): EvaluationSummary {
  const totalSamples = Object.values(counts).reduce((total, count) => total + (count ?? 0), 0);
  const labels = Object.fromEntries(
    EVALUATION_LABELS.map((label) => [label, labelSummary(label, counts[label] ?? 0)])
  ) as Record<EvaluationLabel, EvaluationSummaryByLabel>;
  const remainingSamples = Object.values(labels).reduce(
    (total, label) => total + (label.remainingCount ?? 0),
    0
  );

  return {
    totalSamples,
    targetSamples: EVALUATION_LABELS.length * BASELINE_TARGET_COUNT,
    balancedSampleCount: Object.values(labels).reduce(
      (total, label) => total + Math.min(label.sampleCount, label.targetCount ?? 0),
      0
    ),
    extraSamples: 0,
    completedLabels: Object.values(labels).filter((label) => label.isComplete).length,
    remainingSamples,
    isComplete: remainingSamples === 0,
    falseLookingRate: 0.25,
    falseAwayRate: 0.1,
    labels
  };
}

const keyboardSample: EvaluationSample = {
  id: "sample-1",
  timestampMs: 100,
  label: "keyboard",
  features: null,
  rawState: "looking",
  displayState: "green",
  awayDurationMs: 0,
  trackingScore: 0.8
};

describe("EvaluationPanel", () => {
  it("opens the panel when Evaluate is clicked", () => {
    render(
      <EvaluationPanel
        samples={[]}
        summary={summary()}
        onCapture={vi.fn()}
        onClear={vi.fn()}
        onExport={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Keyboard" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByRole("button", { name: "Keyboard" })).toBeInTheDocument();
  });

  it('calls onCapture("keyboard") when Keyboard is clicked', () => {
    const onCapture = vi.fn();
    render(
      <EvaluationPanel
        samples={[]}
        summary={summary()}
        onCapture={onCapture}
        onClear={vi.fn()}
        onExport={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));
    fireEvent.click(screen.getByRole("button", { name: "Keyboard" }));

    expect(onCapture).toHaveBeenCalledWith("keyboard");
  });

  it("shows target progress and error-rate summary text", () => {
    render(
      <EvaluationPanel
        samples={[keyboardSample]}
        summary={summary({ keyboard: 1 })}
        onCapture={vi.fn()}
        onClear={vi.fn()}
        onExport={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByText("Progress 1/160")).toBeInTheDocument();
    expect(screen.getByText("False-looking 25%")).toBeInTheDocument();
    expect(screen.getByText("False-away 10%")).toBeInTheDocument();
  });

  it("shows per-label target counts and marks completed labels done", () => {
    render(
      <EvaluationPanel
        samples={[keyboardSample]}
        summary={summary({ "screen-center": 1, keyboard: BASELINE_TARGET_COUNT })}
        onCapture={vi.fn()}
        onClear={vi.fn()}
        onExport={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByText("Screen center 1/20")).toBeInTheDocument();
    expect(screen.getByText("Keyboard 20/20 Done")).toBeInTheDocument();
  });

  it("disables completed label capture while leaving incomplete labels enabled", () => {
    const onCapture = vi.fn();
    render(
      <EvaluationPanel
        samples={[keyboardSample]}
        summary={summary({ keyboard: BASELINE_TARGET_COUNT })}
        onCapture={onCapture}
        onClear={vi.fn()}
        onExport={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByRole("button", { name: "Keyboard" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Screen center" })).toBeEnabled();
  });

  it("shows which labels still need samples", () => {
    render(
      <EvaluationPanel
        samples={[keyboardSample]}
        summary={summary({
          "screen-center": BASELINE_TARGET_COUNT,
          "screen-bottom": BASELINE_TARGET_COUNT,
          keyboard: BASELINE_TARGET_COUNT,
          "off-left": BASELINE_TARGET_COUNT,
          "off-right": BASELINE_TARGET_COUNT,
          "lean-left": BASELINE_TARGET_COUNT,
          "lean-right": BASELINE_TARGET_COUNT,
          "low-light": 0
        })}
        onCapture={vi.fn()}
        onClear={vi.fn()}
        onExport={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByText("Missing Low light 20")).toBeInTheDocument();
  });

  it("renders a warning and disables Keyboard when disabledReason is provided", () => {
    render(
      <EvaluationPanel
        samples={[]}
        summary={summary()}
        disabledReason="Waiting for a live attention frame"
        onCapture={vi.fn()}
        onClear={vi.fn()}
        onExport={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByText("Waiting for a live attention frame")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keyboard" })).toBeDisabled();
  });
});
