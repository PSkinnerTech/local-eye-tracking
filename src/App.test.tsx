import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { FrameFeatures } from "./domain/types";

type CapturedAttentionLoopOptions = {
  onFrame: (features: FrameFeatures | null, timestampMs: number) => void;
  onError?: (error: unknown) => void;
};

const appMocks = vi.hoisted(() => {
  const center = {
    pitch: 0,
    yaw: 0,
    eyeVertical: 0,
    eyeHorizontal: 0,
    leftEyeVertical: 0,
    rightEyeVertical: 0,
    leftEyeHorizontal: 0,
    rightEyeHorizontal: 0,
    leftEyeOpenness: 0,
    rightEyeOpenness: 0,
    faceCenterX: 0,
    faceCenterY: 0,
    faceScale: 0
  };
  const tolerance = {
    pitch: 0.1,
    yaw: 0.1,
    eyeVertical: 0.1,
    eyeHorizontal: 0.1,
    leftEyeVertical: 0.1,
    rightEyeVertical: 0.1,
    leftEyeHorizontal: 0.1,
    rightEyeHorizontal: 0.1,
    leftEyeOpenness: 0.1,
    rightEyeOpenness: 0.1,
    faceCenterX: 0.1,
    faceCenterY: 0.1,
    faceScale: 0.1
  };

  return {
    cameraStatus: "idle" as "idle" | "ready",
    requestCamera: vi.fn(),
    createFaceTracker: vi.fn(),
    latestAttentionLoopOptions: null as CapturedAttentionLoopOptions | null,
    calibrationProfile: {
      createdAtMs: 100,
      minValidSamplesPerPoint: 12,
      points: ["center"],
      center,
      tolerance
    }
  };
});

vi.mock("./hooks/useCamera", () => ({
  useCamera: () => ({
    status: appMocks.cameraStatus,
    stream: null,
    errorMessage: null,
    request: appMocks.requestCamera,
    stop: vi.fn()
  })
}));

vi.mock("./hooks/useAttentionLoop", () => ({
  useAttentionLoop: vi.fn((options: CapturedAttentionLoopOptions) => {
    appMocks.latestAttentionLoopOptions = options;
  })
}));

vi.mock("./components/CalibrationScreen", () => ({
  CalibrationScreen: ({ onComplete }: { onComplete: (profile: unknown) => void }) => (
    <button type="button" onClick={() => onComplete(appMocks.calibrationProfile)}>
      Finish calibration
    </button>
  )
}));

vi.mock("./tracking/faceTracker", () => ({
  createFaceTracker: appMocks.createFaceTracker
}));

describe("App", () => {
  beforeEach(() => {
    appMocks.cameraStatus = "idle";
    appMocks.requestCamera.mockReset();
    appMocks.createFaceTracker.mockReset();
    appMocks.createFaceTracker.mockResolvedValue({
      detect: vi.fn(),
      dispose: vi.fn()
    });
    appMocks.latestAttentionLoopOptions = null;
  });

  it("renders setup with camera, tracker, and face readiness", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Calibrate before testing" })).toBeInTheDocument();
    expect(screen.getByText("Camera")).toBeInTheDocument();
    expect(screen.getByText("Tracker")).toBeInTheDocument();
    expect(screen.getByText("Face")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable camera" })).toBeEnabled();
  });

  it("disables evaluation capture after tracker runtime errors", async () => {
    appMocks.cameraStatus = "ready";
    render(<App />);

    const startCalibration = screen.getByRole("button", { name: "Start calibration" });
    await waitFor(() => expect(startCalibration).toBeEnabled());
    fireEvent.click(startCalibration);
    fireEvent.click(screen.getByRole("button", { name: "Finish calibration" }));

    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));
    expect(screen.getByText("Waiting for a live tracking result")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keyboard" })).toBeDisabled();

    await act(async () => {
      appMocks.latestAttentionLoopOptions?.onFrame(frameFeatures(200), 200);
    });

    expect(screen.queryByText("Waiting for a live tracking result")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keyboard" })).toBeEnabled();

    await act(async () => {
      appMocks.latestAttentionLoopOptions?.onError?.(new Error("tracker failed"));
    });

    expect(screen.getByText("Waiting for a live tracking result")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keyboard" })).toBeDisabled();
  });
});

function frameFeatures(timestampMs: number): FrameFeatures {
  return {
    timestampMs,
    faceDetected: true,
    pitch: 0,
    yaw: 0,
    eyeVertical: 0,
    eyeHorizontal: 0,
    leftEyeVertical: 0,
    rightEyeVertical: 0,
    leftEyeHorizontal: 0,
    rightEyeHorizontal: 0,
    leftEyeOpenness: 0,
    rightEyeOpenness: 0,
    faceCenterX: 0,
    faceCenterY: 0,
    faceScale: 0
  };
}
