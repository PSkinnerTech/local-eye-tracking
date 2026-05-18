import { useEffect, useRef } from "react";
import type { FrameFeatures } from "../domain/types";
import type { FaceTracker } from "../tracking/faceTracker";

type UseAttentionLoopOptions = {
  active: boolean;
  tracker: FaceTracker | null;
  video: HTMLVideoElement | null;
  onFrame: (features: FrameFeatures | null, timestampMs: number) => void;
  onError?: (error: unknown) => void;
};

export function useAttentionLoop({
  active,
  tracker,
  video,
  onFrame,
  onError
}: UseAttentionLoopOptions): void {
  const onFrameRef = useRef(onFrame);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!active || !tracker || !video) {
      return;
    }

    let frameId: number | null = null;

    const tick = (timestampMs: number) => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          onFrameRef.current(tracker.detect(video, timestampMs), timestampMs);
        } catch (error) {
          onErrorRef.current?.(error);
          return;
        }
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [active, tracker, video]);
}
