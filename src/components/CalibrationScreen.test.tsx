import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MIN_VALID_SAMPLES_PER_POINT } from "../domain/calibration";
import type { FrameFeatures } from "../domain/types";
import { CalibrationScreen } from "./CalibrationScreen";

function sample(timestampMs: number): FrameFeatures {
  return {
    timestampMs,
    faceDetected: true,
    pitch: 0.42,
    yaw: 0.05,
    eyeVertical: 0.5,
    eyeHorizontal: 0.5,
    faceCenterX: 0.5,
    faceCenterY: 0.45,
    faceScale: 0.62
  };
}

describe("CalibrationScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("retries the same point when there are too few valid samples", () => {
    let rafCallback: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      rafCallback = callback;
      return requestAnimationFrame.mock.calls.length;
    });
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    render(
      <CalibrationScreen
        latestFeatures={sample(0)}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    act(() => {
      rafCallback?.(0);
      rafCallback?.(2000);
    });

    expect(screen.getByText("Top left")).toBeInTheDocument();
    expect(screen.getByText(/Retrying dot/i)).toBeInTheDocument();
  });

  it("completes after enough samples are collected for every calibration point", () => {
    let rafCallback: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      rafCallback = callback;
      return requestAnimationFrame.mock.calls.length;
    });
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const onComplete = vi.fn();

    const { rerender } = render(
      <CalibrationScreen
        latestFeatures={sample(0)}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />
    );

    for (let point = 0; point < 6; point += 1) {
      for (let index = 0; index < MIN_VALID_SAMPLES_PER_POINT + 1; index += 1) {
        const timestamp = point * 3000 + index * 120;
        act(() => {
          rerender(
            <CalibrationScreen
              latestFeatures={sample(timestamp)}
              onComplete={onComplete}
              onCancel={vi.fn()}
            />
          );
        });
        act(() => {
          rafCallback?.(timestamp);
        });
      }
      act(() => {
        rafCallback?.(point * 3000 + 2000);
      });
    }

    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("adds a keyboard-looking calibration step after the screen dots", () => {
    let rafCallback: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      rafCallback = callback;
      return requestAnimationFrame.mock.calls.length;
    });
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { rerender } = render(
      <CalibrationScreen
        latestFeatures={sample(0)}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    for (let point = 0; point < 5; point += 1) {
      for (let index = 0; index < MIN_VALID_SAMPLES_PER_POINT + 1; index += 1) {
        const timestamp = point * 3000 + index * 120;
        act(() => {
          rerender(
            <CalibrationScreen
              latestFeatures={sample(timestamp)}
              onComplete={vi.fn()}
              onCancel={vi.fn()}
            />
          );
        });
        act(() => {
          rafCallback?.(timestamp);
        });
      }
      act(() => {
        rafCallback?.(point * 3000 + 2000);
      });
    }

    expect(screen.getByText("Keyboard")).toBeInTheDocument();
    expect(screen.getByText(/Look at your keyboard/i)).toBeInTheDocument();
  });

  it("does not count the previous point's latest frame after advancing", () => {
    let rafCallback: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      rafCallback = callback;
      return requestAnimationFrame.mock.calls.length;
    });
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { rerender } = render(
      <CalibrationScreen
        latestFeatures={sample(0)}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    for (let index = 0; index < MIN_VALID_SAMPLES_PER_POINT; index += 1) {
      const timestamp = index * 120;
      act(() => {
        rerender(
          <CalibrationScreen
            latestFeatures={sample(timestamp)}
            onComplete={vi.fn()}
            onCancel={vi.fn()}
          />
        );
      });
      act(() => {
        rafCallback?.(timestamp);
      });
    }

    act(() => {
      rafCallback?.(2000);
    });

    expect(screen.getByText("Top right")).toBeInTheDocument();

    act(() => {
      rafCallback?.(2100);
    });

    for (let index = 0; index < MIN_VALID_SAMPLES_PER_POINT - 1; index += 1) {
      const timestamp = 2200 + index * 120;
      act(() => {
        rerender(
          <CalibrationScreen
            latestFeatures={sample(timestamp)}
            onComplete={vi.fn()}
            onCancel={vi.fn()}
          />
        );
      });
      act(() => {
        rafCallback?.(timestamp);
      });
    }

    act(() => {
      rafCallback?.(4100);
    });

    expect(screen.getByText("Top right")).toBeInTheDocument();
    expect(screen.getByText(/Retrying dot/i)).toBeInTheDocument();
  });

  it("cancels the scheduled animation frame on unmount", () => {
    const requestAnimationFrame = vi.fn(() => 42);
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    const { unmount } = render(
      <CalibrationScreen
        latestFeatures={sample(0)}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
  });
});
