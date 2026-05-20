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
  keyboardDistance: 1.4,
  keyboardScore: 0.22,
  keyboardSeparation: 1.8,
  keyboardQuality: "strong"
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
    expect(screen.getByText("Keyboard score")).toBeInTheDocument();
    expect(screen.getByText("0.22")).toBeInTheDocument();
    expect(screen.getByText("Keyboard separation")).toBeInTheDocument();
    expect(screen.getByText("1.80")).toBeInTheDocument();
  });
});
