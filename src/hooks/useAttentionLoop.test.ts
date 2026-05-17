import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FaceTracker } from "../tracking/faceTracker";
import { useAttentionLoop } from "./useAttentionLoop";

describe("useAttentionLoop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("detects frames while active and passes results to the latest callback", () => {
    let rafCallback: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      rafCallback = callback;
      return 7;
    });
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    const frame = {
      timestampMs: 25,
      faceDetected: true,
      pitch: 0,
      yaw: 0,
      eyeVertical: 0,
      eyeHorizontal: 0,
      faceCenterX: 0,
      faceCenterY: 0,
      faceScale: 1
    };
    const tracker: FaceTracker = {
      detect: vi.fn().mockReturnValue(frame),
      dispose: vi.fn()
    };
    const video = document.createElement("video");
    Object.defineProperty(video, "readyState", {
      configurable: true,
      value: HTMLMediaElement.HAVE_CURRENT_DATA
    });
    const firstOnFrame = vi.fn();
    const latestOnFrame = vi.fn();

    const { rerender, unmount } = renderHook(
      ({ onFrame }) =>
        useAttentionLoop({
          active: true,
          tracker,
          video,
          onFrame
        }),
      { initialProps: { onFrame: firstOnFrame } }
    );

    rerender({ onFrame: latestOnFrame });

    act(() => {
      rafCallback?.(25);
    });

    expect(tracker.detect).toHaveBeenCalledWith(video, 25);
    expect(firstOnFrame).not.toHaveBeenCalled();
    expect(latestOnFrame).toHaveBeenCalledWith(frame, 25);

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
  });
});
