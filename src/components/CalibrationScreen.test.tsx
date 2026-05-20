import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MIN_VALID_SAMPLES_PER_POINT } from "../domain/calibration";
import type { FrameFeatures } from "../domain/types";
import { CalibrationScreen } from "./CalibrationScreen";

function sample(timestampMs: number, overrides: Partial<FrameFeatures> = {}): FrameFeatures {
  return {
    timestampMs,
    faceDetected: true,
    pitch: 0.42,
    yaw: 0.05,
    eyeVertical: 0.5,
    eyeHorizontal: 0.5,
    leftEyeVertical: 0.5,
    rightEyeVertical: 0.5,
    leftEyeHorizontal: 0.5,
    rightEyeHorizontal: 0.5,
    leftEyeOpenness: 0.06,
    rightEyeOpenness: 0.06,
    faceCenterX: 0.5,
    faceCenterY: 0.45,
    faceScale: 0.62,
    ...overrides
  };
}

function keyboardSample(timestampMs: number): FrameFeatures {
  return sample(timestampMs, {
    pitch: 0.46,
    eyeVertical: 0.72,
    leftEyeVertical: 0.72,
    rightEyeVertical: 0.72
  });
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

    const { rerender } = render(
      <CalibrationScreen
        latestFeatures={sample(0)}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    act(() => {
      rafCallback?.(0);
    });
    act(() => {
      rerender(
        <CalibrationScreen
          latestFeatures={sample(2000)}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });
    act(() => {
      rafCallback?.(2000);
    });

    expect(screen.getByText("Top left")).toBeInTheDocument();
    expect(screen.getByText(/Retrying dot/i)).toBeInTheDocument();
  });

  it("waits for a detected face before starting the calibration timer", () => {
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
        latestFeatures={null}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    act(() => {
      rafCallback?.(0);
      rafCallback?.(3000);
    });

    expect(screen.getByText("Top left")).toBeInTheDocument();
    expect(screen.getByText(/Waiting for face/i)).toBeInTheDocument();
    expect(screen.queryByText(/Retrying dot/i)).not.toBeInTheDocument();
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
        const features = point === 5 ? keyboardSample(timestamp) : sample(timestamp);
        act(() => {
          rerender(
            <CalibrationScreen
              latestFeatures={features}
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

  it("retries keyboard calibration when keyboard separation is weak", () => {
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

    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText("Keyboard")).toBeInTheDocument();
    expect(screen.getByText(/Keyboard calibration weak/i)).toBeInTheDocument();

    for (let index = 0; index < MIN_VALID_SAMPLES_PER_POINT + 1; index += 1) {
      const timestamp = 18_000 + index * 120;
      act(() => {
        rerender(
          <CalibrationScreen
            latestFeatures={keyboardSample(timestamp)}
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
      rafCallback?.(20_000);
    });

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

    for (let index = 0; index < MIN_VALID_SAMPLES_PER_POINT + 1; index += 1) {
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
