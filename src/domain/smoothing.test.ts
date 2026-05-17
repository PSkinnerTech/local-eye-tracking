import { describe, expect, it } from "vitest";
import { createAttentionSmoother } from "./smoothing";

describe("createAttentionSmoother", () => {
  it("stays green during short away glances", () => {
    const smoother = createAttentionSmoother({ awayThresholdMs: 900, unknownGraceMs: 500 });

    expect(smoother.update("looking", 0).displayState).toBe("green");
    expect(smoother.update("away", 100).displayState).toBe("green");
    expect(smoother.update("away", 850).displayState).toBe("green");
  });

  it("turns red after continuous away evidence reaches the threshold", () => {
    const smoother = createAttentionSmoother({ awayThresholdMs: 900, unknownGraceMs: 500 });

    smoother.update("looking", 0);
    smoother.update("away", 100);
    expect(smoother.update("away", 1000).displayState).toBe("red");
  });

  it("returns green immediately after looking resumes", () => {
    const smoother = createAttentionSmoother({ awayThresholdMs: 900, unknownGraceMs: 500 });

    smoother.update("looking", 0);
    smoother.update("away", 100);
    smoother.update("away", 1000);
    expect(smoother.update("looking", 1016).displayState).toBe("green");
  });

  it("lets unknown hold briefly before counting toward red", () => {
    const smoother = createAttentionSmoother({ awayThresholdMs: 900, unknownGraceMs: 500 });

    smoother.update("looking", 0);
    expect(smoother.update("unknown", 100).displayState).toBe("green");
    expect(smoother.update("unknown", 550).displayState).toBe("green");
    expect(smoother.update("unknown", 1500).displayState).toBe("red");
  });

  it("turns red after continuous face-missing evidence reaches the threshold", () => {
    const smoother = createAttentionSmoother({ awayThresholdMs: 900, unknownGraceMs: 500 });

    smoother.update("looking", 0);
    expect(smoother.update("face-missing", 100).displayState).toBe("green");
    expect(smoother.update("face-missing", 1000).displayState).toBe("red");
  });
});
