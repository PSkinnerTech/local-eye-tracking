import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TestScreen } from "./TestScreen";
import type { AttentionResult } from "../domain/types";

const attention: AttentionResult = {
  rawState: "looking",
  confidence: 0.86,
  distance: 0.42,
  trackingScore: 0.74,
  screenDistance: 0.42,
  sideGazeScore: 1.45,
  sideGazeDirection: "right",
  keyboardDistance: 1.4,
  keyboardScore: 0.22,
  keyboardSeparation: 1.8,
  keyboardQuality: "strong",
  learnedScreenDistance: 0.35,
  learnedKeyboardDistance: 1.45,
  learnedKeyboardScore: 0.22,
  learnedMargin: -1.1,
  learnedModelSeparation: 1.9
};

describe("TestScreen", () => {
  it("renders live diagnostics for calibration and keyboard separation", () => {
    render(
      <TestScreen
        displayState="green"
        attention={attention}
        smoother={{
          displayState: "green",
          rawState: "looking",
          awayDurationMs: 0
        }}
        onRecalibrate={vi.fn()}
      />
    );

    expect(screen.getByText("Calibration strong")).toBeInTheDocument();
    expect(screen.getByText("Screen distance")).toBeInTheDocument();
    expect(screen.getByText("0.42")).toBeInTheDocument();
    expect(screen.getByText("Side gaze")).toBeInTheDocument();
    expect(screen.getByText("1.45 right")).toBeInTheDocument();
    expect(screen.getByText("Keyboard score")).toBeInTheDocument();
    expect(screen.getAllByText("0.22")).toHaveLength(2);
    expect(screen.getByText("Keyboard separation")).toBeInTheDocument();
    expect(screen.getByText("1.80")).toBeInTheDocument();
    expect(screen.getByText("Learned keyboard distance")).toBeInTheDocument();
    expect(screen.getByText("Learned keyboard score")).toBeInTheDocument();
    expect(screen.getByText("Learned margin")).toBeInTheDocument();
    expect(screen.getByText("Learned separation")).toBeInTheDocument();
  });

  it("renders evaluation controls when provided", () => {
    render(
      <TestScreen
        displayState="green"
        attention={attention}
        smoother={{
          displayState: "green",
          rawState: "looking",
          awayDurationMs: 0
        }}
        evaluation={{
          samples: [],
          summary: {
            totalSamples: 0,
            falseLookingRate: null,
            falseAwayRate: null,
            labels: {
              "screen-center": emptyEvaluationLabel(),
              "screen-bottom": emptyEvaluationLabel(),
              keyboard: emptyEvaluationLabel(),
              "off-left": emptyEvaluationLabel(),
              "off-right": emptyEvaluationLabel(),
              "lean-left": emptyEvaluationLabel(),
              "lean-right": emptyEvaluationLabel(),
              "low-light": emptyEvaluationLabel()
            }
          },
          onCapture: vi.fn(),
          onClear: vi.fn(),
          onExport: vi.fn()
        }}
        onRecalibrate={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Evaluate" })).toBeInTheDocument();
  });

  it("shows face-framing guidance when the face is missing", () => {
    render(
      <TestScreen
        displayState="red"
        attention={{
          rawState: "face-missing",
          confidence: 1,
          distance: Number.POSITIVE_INFINITY,
          trackingScore: 0
        }}
        smoother={{
          displayState: "red",
          rawState: "face-missing",
          awayDurationMs: 900
        }}
        onRecalibrate={vi.fn()}
      />
    );

    expect(screen.getByText("Face not detected")).toBeInTheDocument();
    expect(screen.getByText("Move back into the webcam frame")).toBeInTheDocument();
  });
});

function emptyEvaluationLabel() {
  return {
    sampleCount: 0,
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
