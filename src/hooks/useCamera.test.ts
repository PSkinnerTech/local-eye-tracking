import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCamera } from "./useCamera";

function makeStream() {
  const stop = vi.fn();
  return {
    stream: {
      getTracks: () => [{ stop }]
    } as unknown as MediaStream,
    stop
  };
}

describe("useCamera", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests a user-facing video stream and stops it on demand", async () => {
    const { stream, stop } = makeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia }
    });

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.request();
    });

    expect(getUserMedia).toHaveBeenCalledWith({
      video: {
        facingMode: "user",
        width: { ideal: 960 },
        height: { ideal: 540 }
      },
      audio: false
    });
    expect(result.current.status).toBe("ready");
    expect(result.current.stream).toBe(stream);

    act(() => {
      result.current.stop();
    });

    expect(stop).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("idle");
    expect(result.current.stream).toBeNull();
  });

  it("maps denied camera errors to a denied state", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException("Blocked", "NotAllowedError"))
      }
    });

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.request();
    });

    expect(result.current.status).toBe("denied");
    expect(result.current.errorMessage).toBe(
      "Camera access is required for local attention tracking."
    );
  });
});
