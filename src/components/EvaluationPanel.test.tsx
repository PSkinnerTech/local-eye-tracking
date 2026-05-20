import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  EVALUATION_LABELS,
  type EvaluationLabel,
  type EvaluationSample,
  type EvaluationSummary,
  type EvaluationSummaryByLabel
} from "../domain/evaluation";
import { EvaluationPanel } from "./EvaluationPanel";

function labelSummary(sampleCount = 0): EvaluationSummaryByLabel {
  return {
    sampleCount,
    lookingPercent: 0,
    unknownPercent: 0,
    awayPercent: 0,
    faceMissingPercent: 0,
    medianTrackingScore: null,
    medianKeyboardScore: null
  };
}

function summary(totalSamples = 0): EvaluationSummary {
  return {
    totalSamples,
    falseLookingRate: 0.25,
    falseAwayRate: 0.1,
    labels: Object.fromEntries(
      EVALUATION_LABELS.map((label) => [label, labelSummary(label === "keyboard" ? 1 : 0)])
    ) as Record<EvaluationLabel, EvaluationSummaryByLabel>
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

  it("shows sample and error-rate summary text", () => {
    render(
      <EvaluationPanel
        samples={[keyboardSample]}
        summary={summary(1)}
        onCapture={vi.fn()}
        onClear={vi.fn()}
        onExport={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByText("Samples 1")).toBeInTheDocument();
    expect(screen.getByText("False-looking 25%")).toBeInTheDocument();
    expect(screen.getByText("False-away 10%")).toBeInTheDocument();
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
