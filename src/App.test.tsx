import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("./hooks/useCamera", () => ({
  useCamera: () => ({
    status: "idle",
    stream: null,
    errorMessage: null,
    request: vi.fn(),
    stop: vi.fn()
  })
}));

vi.mock("./hooks/useAttentionLoop", () => ({
  useAttentionLoop: vi.fn()
}));

vi.mock("./tracking/faceTracker", () => ({
  createFaceTracker: vi.fn(() =>
    Promise.resolve({
      detect: vi.fn(),
      dispose: vi.fn()
    })
  )
}));

describe("App", () => {
  it("renders setup with camera, tracker, and face readiness", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Calibrate before testing" })).toBeInTheDocument();
    expect(screen.getByText("Camera")).toBeInTheDocument();
    expect(screen.getByText("Tracker")).toBeInTheDocument();
    expect(screen.getByText("Face")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable camera" })).toBeEnabled();
  });
});
