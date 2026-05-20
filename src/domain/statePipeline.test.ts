import { describe, expect, it, vi } from "vitest";
import type { AttentionResult } from "./types";
import { smoothAttentionResult } from "./statePipeline";

const unknownAttention: AttentionResult = {
  rawState: "unknown",
  confidence: 0.2,
  distance: 1.2,
  trackingScore: 0.1,
  screenDistance: 1.2
};

describe("smoothAttentionResult", () => {
  it("passes classifier unknown directly into the smoother even with low tracking score", () => {
    const smoother = {
      update: vi.fn(() => ({
        displayState: "green" as const,
        rawState: "unknown" as const,
        awayDurationMs: 0
      }))
    };

    const result = smoothAttentionResult(unknownAttention, smoother, 250);

    expect(smoother.update).toHaveBeenCalledWith("unknown", 250);
    expect(result.attention).toBe(unknownAttention);
    expect(result.smootherSnapshot.rawState).toBe("unknown");
    expect(result.displayState).toBe("green");
  });
});
