import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SetupScreen } from "./SetupScreen";

describe("SetupScreen", () => {
  it("allows calibration to start once the camera and tracker are ready", () => {
    render(
      <SetupScreen
        cameraStatus="ready"
        trackerStatus="ready"
        errorMessage={null}
        hasFace={false}
        onRequestCamera={vi.fn()}
        onStartCalibration={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Start calibration" })).toBeEnabled();
  });
});
