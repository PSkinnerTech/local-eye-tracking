import type { RawAttentionState } from "./types";

export type DisplayAttentionState = "green" | "red";

export type SmootherConfig = {
  awayThresholdMs: number;
  unknownGraceMs: number;
};

export type SmootherSnapshot = {
  displayState: DisplayAttentionState;
  rawState: RawAttentionState;
  awayDurationMs: number;
};

export function createAttentionSmoother(
  config: SmootherConfig = { awayThresholdMs: 900, unknownGraceMs: 500 }
) {
  let displayState: DisplayAttentionState = "green";
  let awayStartedAtMs: number | null = null;
  let unknownStartedAtMs: number | null = null;

  return {
    update(rawState: RawAttentionState, timestampMs: number): SmootherSnapshot {
      if (rawState === "looking") {
        displayState = "green";
        awayStartedAtMs = null;
        unknownStartedAtMs = null;
        return { displayState, rawState, awayDurationMs: 0 };
      }

      if (rawState === "unknown") {
        unknownStartedAtMs ??= timestampMs;
        const unknownDuration = timestampMs - unknownStartedAtMs;
        if (unknownDuration < config.unknownGraceMs) {
          return { displayState, rawState, awayDurationMs: 0 };
        }
        awayStartedAtMs ??= unknownStartedAtMs + config.unknownGraceMs;
      } else {
        unknownStartedAtMs = null;
        awayStartedAtMs ??= timestampMs;
      }

      const awayDurationMs = timestampMs - awayStartedAtMs;
      if (awayDurationMs >= config.awayThresholdMs) {
        displayState = "red";
      }

      return { displayState, rawState, awayDurationMs };
    },
    reset() {
      displayState = "green";
      awayStartedAtMs = null;
      unknownStartedAtMs = null;
    }
  };
}
