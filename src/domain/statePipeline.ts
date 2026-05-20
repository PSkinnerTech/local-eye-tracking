import type { DisplayAttentionState, SmootherSnapshot } from "./smoothing";
import type { AttentionResult, RawAttentionState } from "./types";

type AttentionSmootherLike = {
  update(rawState: RawAttentionState, timestampMs: number): SmootherSnapshot;
};

export type SmoothedAttentionResult = {
  attention: AttentionResult;
  smootherSnapshot: SmootherSnapshot;
  displayState: DisplayAttentionState;
};

export function smoothAttentionResult(
  attention: AttentionResult,
  smoother: AttentionSmootherLike,
  timestampMs: number
): SmoothedAttentionResult {
  const smootherSnapshot = smoother.update(attention.rawState, timestampMs);

  return {
    attention,
    smootherSnapshot,
    displayState: smootherSnapshot.displayState
  };
}
