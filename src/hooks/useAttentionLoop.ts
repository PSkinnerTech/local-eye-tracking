import { useEffect, useRef } from "react";
import type { FrameFeatures } from "../domain/types";
import type { FaceTracker } from "../tracking/faceTracker";

type UseAttentionLoopOptions = {
  active: boolean;
  tracker: FaceTracker | null;
  video: HTMLVideoElement | null;
  onFrame: (features: FrameFeatures | null, timestampMs: number) => void;
};

export function useAttentionLoop({
  active,
  tracker,
  video,
  onFrame
}: UseAttentionLoopOptions): void {
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!active || !tracker || !video) {
      return;
    }

    let frameId: number | null = null;

    const tick = (timestampMs: number) => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        onFrameRef.current(tracker.detect(video, timestampMs), timestampMs);
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
