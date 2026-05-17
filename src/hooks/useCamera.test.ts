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

function makeDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe("useCamera", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it("stops a pending stream that resolves after unmount", async () => {
    const pending = makeDeferred<MediaStream>();
    const { stream, stop } = makeStream();
    const getUserMedia = vi.fn().mockReturnValue(pending.promise);
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia }
    });

    const { result, unmount } = renderHook(() => useCamera());

    void act(() => {
      void result.current.request();
    });

    unmount();

    pending.resolve(stream);

    await act(async () => {
      await pending.promise;
    });

    expect(stop).toHaveBeenCalledOnce();
  });

  it("keeps the newest request when an older request resolves later", async () => {
    const older = makeDeferred<MediaStream>();
    const newer = makeDeferred<MediaStream>();
    const olderStream = makeStream();
    const newerStream = makeStream();
    const getUserMedia = vi
      .fn()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia }
    });

    const { result } = renderHook(() => useCamera());

    let olderRequest: Promise<void>;
    let newerRequest: Promise<void>;
    void act(() => {
      olderRequest = result.current.request();
    });
    void act(() => {
      newerRequest = result.current.request();
    });

    newer.resolve(newerStream.stream);
    await act(async () => {
      await newerRequest;
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.stream).toBe(newerStream.stream);

    older.resolve(olderStream.stream);
    await act(async () => {
      await olderRequest;
    });

    expect(olderStream.stop).toHaveBeenCalledOnce();
    expect(newerStream.stop).not.toHaveBeenCalled();
    expect(result.current.status).toBe("ready");
    expect(result.current.stream).toBe(newerStream.stream);
  });
});
