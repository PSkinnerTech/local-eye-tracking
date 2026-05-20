# Attention State Pipeline Evaluation Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve classifier raw-state semantics through smoothing and add a local-only labeled evaluation harness for tuning keyboard-looking detection.

**Architecture:** Add a tiny domain helper for turning an `AttentionResult` into a smoother update, then add a separate evaluation domain module that stores numeric feature samples and computes summary metrics. Wire those pieces into the existing full-screen `TestScreen` with a secondary evaluation panel and keep all samples in React memory unless the user exports JSON.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, MediaPipe Face Landmarker.

---

## File Structure

- Create `src/domain/statePipeline.ts`: small helper that sends `attention.rawState` directly to the smoother and returns the snapshot/display state tuple used by `App`.
- Create `src/domain/statePipeline.test.ts`: regression test proving `unknown` is preserved even when tracking score is below the display threshold.
- Create `src/domain/evaluation.ts`: label definitions, sample creation, summary metrics, false-looking/false-away calculations, and export payload creation.
- Create `src/domain/evaluation.test.ts`: unit tests for sample creation, per-label summaries, median metrics, and export shape.
- Create `src/components/EvaluationPanel.tsx`: secondary test-mode panel for labeled capture, summary counts, clear, and export controls.
- Create `src/components/EvaluationPanel.test.tsx`: UI tests for label controls, counts, disabled state, and action callbacks.
- Modify `src/App.tsx`: use `smoothAttentionResult()` instead of `rawStateForTrackingThreshold()`, own evaluation samples in memory, clear samples on recalibration, and export JSON locally.
- Modify `src/components/TestScreen.tsx`: accept optional evaluation controls and render `EvaluationPanel`.
- Modify `src/components/TestScreen.test.tsx`: cover evaluation panel presence in test mode.
- Modify `src/styles.css`: add compact evaluation panel styles that do not disrupt full-screen green/red feedback.

---

### Task 1: Preserve Classifier Raw State Through Smoothing

**Files:**
- Create: `src/domain/statePipeline.ts`
- Create: `src/domain/statePipeline.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing state-pipeline test**

Create `src/domain/statePipeline.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/domain/statePipeline.test.ts
```

Expected: FAIL because `src/domain/statePipeline.ts` does not exist.

- [ ] **Step 3: Implement the state-pipeline helper**

Create `src/domain/statePipeline.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/domain/statePipeline.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire the helper into App**

Modify the imports in `src/App.tsx`:

```ts
import { classifyAttention } from "./domain/classifier";
import { smoothAttentionResult } from "./domain/statePipeline";
```

Replace the test-mode frame handling block:

```ts
const nextAttention = classifyAttention(features, profile);
const smoothed = smoothAttentionResult(nextAttention, smootherRef.current, timestampMs);
setAttention(smoothed.attention);
setSmootherSnapshot(smoothed.smootherSnapshot);
setDisplayState(smoothed.displayState);
```

Remove the `rawStateForTrackingThreshold` import from `src/App.tsx`.

- [ ] **Step 6: Verify App still builds and smoothing tests remain green**

Run:

```bash
npm test -- src/domain/statePipeline.test.ts src/domain/smoothing.test.ts src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add src/domain/statePipeline.ts src/domain/statePipeline.test.ts src/App.tsx
git commit -m "fix: preserve classifier state through smoothing"
```

Expected: commit succeeds. If the working tree still contains older uncommitted changes in `src/App.tsx`, review `git diff src/App.tsx` before committing so the commit contains only intended app-pipeline changes.

---

### Task 2: Add Evaluation Domain Model And Metrics

**Files:**
- Create: `src/domain/evaluation.ts`
- Create: `src/domain/evaluation.test.ts`

- [ ] **Step 1: Write failing tests for sample creation and summaries**

Create `src/domain/evaluation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AttentionResult, FrameFeatures } from "./types";
import {
  addEvaluationSample,
  createEvaluationExport,
  summarizeEvaluation
} from "./evaluation";

const features: FrameFeatures = {
  timestampMs: 100,
  faceDetected: true,
  pitch: 0.2,
  yaw: 0.1,
  eyeVertical: 0.5,
  eyeHorizontal: 0.5,
  leftEyeVertical: 0.5,
  rightEyeVertical: 0.5,
  leftEyeHorizontal: 0.5,
  rightEyeHorizontal: 0.5,
  leftEyeOpenness: 0.04,
  rightEyeOpenness: 0.04,
  faceCenterX: 0.5,
  faceCenterY: 0.45,
  faceScale: 0.62
};

function attention(rawState: AttentionResult["rawState"], trackingScore: number): AttentionResult {
  return {
    rawState,
    confidence: 0.7,
    distance: 0.4,
    trackingScore,
    screenDistance: 0.4,
    keyboardDistance: 1.3,
    keyboardScore: 0.2,
    keyboardSeparation: 1.8,
    keyboardQuality: "strong"
  };
}

describe("evaluation", () => {
  it("adds labeled samples with feature and attention diagnostics", () => {
    const samples = addEvaluationSample([], {
      label: "screen-center",
      timestampMs: 150,
      features,
      attention: attention("looking", 0.95),
      smootherSnapshot: {
        displayState: "green",
        rawState: "looking",
        awayDurationMs: 0
      }
    });

    expect(samples).toHaveLength(1);
    expect(samples[0].label).toBe("screen-center");
    expect(samples[0].features?.eyeVertical).toBe(0.5);
    expect(samples[0].rawState).toBe("looking");
    expect(samples[0].displayState).toBe("green");
    expect(samples[0].trackingScore).toBe(0.95);
  });

  it("summarizes false-looking and false-away rates by label role", () => {
    const samples = [
      ...addEvaluationSample([], {
        label: "screen-center",
        timestampMs: 100,
        features,
        attention: attention("looking", 0.95),
        smootherSnapshot: { displayState: "green", rawState: "looking", awayDurationMs: 0 }
      }),
      ...addEvaluationSample([], {
        label: "screen-center",
        timestampMs: 120,
        features,
        attention: attention("away", 0.2),
        smootherSnapshot: { displayState: "red", rawState: "away", awayDurationMs: 900 }
      }),
      ...addEvaluationSample([], {
        label: "keyboard",
        timestampMs: 140,
        features,
        attention: attention("looking", 0.8),
        smootherSnapshot: { displayState: "green", rawState: "looking", awayDurationMs: 0 }
      }),
      ...addEvaluationSample([], {
        label: "keyboard",
        timestampMs: 160,
        features,
        attention: attention("away", 0.25),
        smootherSnapshot: { displayState: "red", rawState: "away", awayDurationMs: 900 }
      })
    ];

    const summary = summarizeEvaluation(samples);

    expect(summary.totalSamples).toBe(4);
    expect(summary.falseAwayRate).toBe(0.5);
    expect(summary.falseLookingRate).toBe(0.5);
    expect(summary.labels["screen-center"].lookingPercent).toBe(0.5);
    expect(summary.labels.keyboard.awayPercent).toBe(0.5);
  });

  it("creates an export payload with samples and summary metadata", () => {
    const samples = addEvaluationSample([], {
      label: "off-left",
      timestampMs: 200,
      features: null,
      attention: attention("face-missing", 0),
      smootherSnapshot: {
        displayState: "red",
        rawState: "face-missing",
        awayDurationMs: 900
      }
    });

    const payload = createEvaluationExport(samples, 300);

    expect(payload.version).toBe(1);
    expect(payload.createdAtMs).toBe(300);
    expect(payload.samples[0].features).toBeNull();
    expect(payload.summary.totalSamples).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/domain/evaluation.test.ts
```

Expected: FAIL because `src/domain/evaluation.ts` does not exist.

- [ ] **Step 3: Implement evaluation labels, samples, and summaries**

Create `src/domain/evaluation.ts` with these public types and functions:

```ts
import type {
  AttentionResult,
  FrameFeatures,
  KeyboardCalibrationQuality,
  RawAttentionState
} from "./types";
import type { DisplayAttentionState, SmootherSnapshot } from "./smoothing";

export const EVALUATION_LABELS = [
  "screen-center",
  "screen-bottom",
  "keyboard",
  "off-left",
  "off-right",
  "lean-left",
  "lean-right",
  "low-light"
] as const;

export type EvaluationLabel = (typeof EVALUATION_LABELS)[number];

const SCREEN_LABELS = new Set<EvaluationLabel>([
  "screen-center",
  "screen-bottom",
  "lean-left",
  "lean-right",
  "low-light"
]);

const AWAY_LABELS = new Set<EvaluationLabel>(["keyboard", "off-left", "off-right"]);

export type EvaluationSample = {
  id: string;
  timestampMs: number;
  label: EvaluationLabel;
  features: FrameFeatures | null;
  rawState: RawAttentionState;
  displayState: DisplayAttentionState;
  awayDurationMs: number;
  trackingScore: number;
  screenDistance?: number;
  keyboardDistance?: number;
  keyboardScore?: number;
  keyboardSeparation?: number;
  keyboardQuality?: KeyboardCalibrationQuality;
};

export type EvaluationSummaryByLabel = {
  sampleCount: number;
  lookingPercent: number;
  unknownPercent: number;
  awayPercent: number;
  faceMissingPercent: number;
  medianTrackingScore: number | null;
  medianKeyboardScore: number | null;
};

export type EvaluationSummary = {
  totalSamples: number;
  falseLookingRate: number | null;
  falseAwayRate: number | null;
  labels: Record<EvaluationLabel, EvaluationSummaryByLabel>;
};

export type EvaluationExport = {
  version: 1;
  createdAtMs: number;
  summary: EvaluationSummary;
  samples: EvaluationSample[];
};

type AddEvaluationSampleInput = {
  label: EvaluationLabel;
  timestampMs: number;
  features: FrameFeatures | null;
  attention: AttentionResult;
  smootherSnapshot: SmootherSnapshot;
};

export function addEvaluationSample(
  samples: EvaluationSample[],
  input: AddEvaluationSampleInput
): EvaluationSample[] {
  return [
    ...samples,
    {
      id: `${input.timestampMs}-${samples.length + 1}`,
      timestampMs: input.timestampMs,
      label: input.label,
      features: input.features,
      rawState: input.attention.rawState,
      displayState: input.smootherSnapshot.displayState,
      awayDurationMs: input.smootherSnapshot.awayDurationMs,
      trackingScore: input.attention.trackingScore,
      screenDistance: input.attention.screenDistance ?? input.attention.distance,
      keyboardDistance: input.attention.keyboardDistance,
      keyboardScore: input.attention.keyboardScore,
      keyboardSeparation: input.attention.keyboardSeparation,
      keyboardQuality: input.attention.keyboardQuality
    }
  ];
}

export function summarizeEvaluation(samples: EvaluationSample[]): EvaluationSummary {
  const labels = Object.fromEntries(
    EVALUATION_LABELS.map((label) => [label, summarizeLabel(samples, label)])
  ) as Record<EvaluationLabel, EvaluationSummaryByLabel>;

  const awaySamples = samples.filter((sample) => AWAY_LABELS.has(sample.label));
  const screenSamples = samples.filter((sample) => SCREEN_LABELS.has(sample.label));

  return {
    totalSamples: samples.length,
    falseLookingRate: rate(
      awaySamples.filter((sample) => sample.rawState === "looking").length,
      awaySamples.length
    ),
    falseAwayRate: rate(
      screenSamples.filter((sample) => sample.rawState === "away").length,
      screenSamples.length
    ),
    labels
  };
}

export function createEvaluationExport(
  samples: EvaluationSample[],
  createdAtMs = Date.now()
): EvaluationExport {
  return {
    version: 1,
    createdAtMs,
    summary: summarizeEvaluation(samples),
    samples
  };
}

function summarizeLabel(
  samples: EvaluationSample[],
  label: EvaluationLabel
): EvaluationSummaryByLabel {
  const labelSamples = samples.filter((sample) => sample.label === label);
  const count = labelSamples.length;

  return {
    sampleCount: count,
    lookingPercent: statePercent(labelSamples, "looking"),
    unknownPercent: statePercent(labelSamples, "unknown"),
    awayPercent: statePercent(labelSamples, "away"),
    faceMissingPercent: statePercent(labelSamples, "face-missing"),
    medianTrackingScore: median(labelSamples.map((sample) => sample.trackingScore)),
    medianKeyboardScore: median(
      labelSamples
        .map((sample) => sample.keyboardScore)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    )
  };
}

function statePercent(samples: EvaluationSample[], rawState: RawAttentionState): number {
  return rate(samples.filter((sample) => sample.rawState === rawState).length, samples.length) ?? 0;
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function median(values: number[]): number | null {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);

  if (finite.length === 0) {
    return null;
  }

  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 === 1 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- src/domain/evaluation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add src/domain/evaluation.ts src/domain/evaluation.test.ts
git commit -m "feat: add attention evaluation metrics"
```

Expected: commit succeeds.

---

### Task 3: Build Evaluation Panel UI

**Files:**
- Create: `src/components/EvaluationPanel.tsx`
- Create: `src/components/EvaluationPanel.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing UI tests**

Create `src/components/EvaluationPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EvaluationSample, EvaluationSummary } from "../domain/evaluation";
import { EvaluationPanel } from "./EvaluationPanel";

const summary: EvaluationSummary = {
  totalSamples: 1,
  falseLookingRate: 0.25,
  falseAwayRate: 0.1,
  labels: {
    "screen-center": emptyLabel(1),
    "screen-bottom": emptyLabel(0),
    keyboard: emptyLabel(0),
    "off-left": emptyLabel(0),
    "off-right": emptyLabel(0),
    "lean-left": emptyLabel(0),
    "lean-right": emptyLabel(0),
    "low-light": emptyLabel(0)
  }
};

const samples: EvaluationSample[] = [
  {
    id: "1",
    timestampMs: 100,
    label: "screen-center",
    features: null,
    rawState: "looking",
    displayState: "green",
    awayDurationMs: 0,
    trackingScore: 0.95
  }
];

function emptyLabel(sampleCount: number) {
  return {
    sampleCount,
    lookingPercent: sampleCount > 0 ? 1 : 0,
    unknownPercent: 0,
    awayPercent: 0,
    faceMissingPercent: 0,
    medianTrackingScore: sampleCount > 0 ? 0.95 : null,
    medianKeyboardScore: null
  };
}

describe("EvaluationPanel", () => {
  it("captures a labeled keyboard sample from the panel", () => {
    const onCapture = vi.fn();

    render(
      <EvaluationPanel
        samples={samples}
        summary={summary}
        onCapture={onCapture}
        onClear={vi.fn()}
        onExport={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));
    fireEvent.click(screen.getByRole("button", { name: "Keyboard" }));

    expect(onCapture).toHaveBeenCalledWith("keyboard");
    expect(screen.getByText("Samples 1")).toBeInTheDocument();
    expect(screen.getByText("False-looking 25%")).toBeInTheDocument();
    expect(screen.getByText("False-away 10%")).toBeInTheDocument();
  });

  it("disables label capture when there is no current attention result", () => {
    render(
      <EvaluationPanel
        samples={[]}
        summary={{ ...summary, totalSamples: 0 }}
        disabledReason="Waiting for a live tracking result"
        onCapture={vi.fn()}
        onClear={vi.fn()}
        onExport={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByText("Waiting for a live tracking result")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keyboard" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/components/EvaluationPanel.test.tsx
```

Expected: FAIL because `src/components/EvaluationPanel.tsx` does not exist.

- [ ] **Step 3: Implement the evaluation panel**

Create `src/components/EvaluationPanel.tsx`:

```tsx
import { useState } from "react";
import {
  EVALUATION_LABELS,
  type EvaluationLabel,
  type EvaluationSample,
  type EvaluationSummary
} from "../domain/evaluation";

type EvaluationPanelProps = {
  samples: EvaluationSample[];
  summary: EvaluationSummary;
  disabledReason?: string;
  onCapture: (label: EvaluationLabel) => void;
  onClear: () => void;
  onExport: () => void;
};

const LABEL_TEXT: Record<EvaluationLabel, string> = {
  "screen-center": "Screen center",
  "screen-bottom": "Screen bottom",
  keyboard: "Keyboard",
  "off-left": "Off left",
  "off-right": "Off right",
  "lean-left": "Lean left",
  "lean-right": "Lean right",
  "low-light": "Low light"
};

export function EvaluationPanel({
  samples,
  summary,
  disabledReason,
  onCapture,
  onClear,
  onExport
}: EvaluationPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <aside className="evaluation-panel" aria-label="Evaluation harness">
      <button
        className="evaluation-toggle"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        Evaluate
      </button>
      {open ? (
        <div className="evaluation-body">
          <div className="evaluation-summary" aria-label="Evaluation summary">
            <span>Samples {summary.totalSamples}</span>
            <span>False-looking {formatPercent(summary.falseLookingRate)}</span>
            <span>False-away {formatPercent(summary.falseAwayRate)}</span>
          </div>
          {disabledReason ? <p className="evaluation-warning">{disabledReason}</p> : null}
          <div className="evaluation-label-grid" aria-label="Evaluation labels">
            {EVALUATION_LABELS.map((label) => (
              <button
                key={label}
                type="button"
                disabled={Boolean(disabledReason)}
                onClick={() => onCapture(label)}
              >
                {LABEL_TEXT[label]}
              </button>
            ))}
          </div>
          <div className="evaluation-counts" aria-label="Evaluation counts">
            {EVALUATION_LABELS.map((label) => (
              <span key={label}>
                {LABEL_TEXT[label]} {summary.labels[label].sampleCount}
              </span>
            ))}
          </div>
          <div className="evaluation-actions">
            <button type="button" disabled={samples.length === 0} onClick={onExport}>
              Export JSON
            </button>
            <button type="button" disabled={samples.length === 0} onClick={onClear}>
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return `${Math.round(value * 100)}%`;
}
```

- [ ] **Step 4: Add compact styles**

Add to `src/styles.css` near the test-screen styles:

```css
.evaluation-panel {
  position: fixed;
  top: 24px;
  left: 24px;
  z-index: 3;
  width: min(360px, calc(100% - 48px));
  color: #17211b;
}

.evaluation-toggle,
.evaluation-label-grid button,
.evaluation-actions button {
  min-height: 36px;
  border: 2px solid #17211b;
  border-radius: 8px;
  color: #17211b;
  background: #fffdf4;
  cursor: pointer;
  font-weight: 800;
  letter-spacing: 0;
}

.evaluation-toggle {
  padding: 0 14px;
}

.evaluation-body {
  display: grid;
  gap: 12px;
  margin-top: 10px;
  padding: 14px;
  border: 2px solid #17211b;
  border-radius: 8px;
  background: rgb(255 253 244 / 92%);
  box-shadow: 0 14px 30px rgb(0 0 0 / 14%);
}

.evaluation-summary,
.evaluation-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.78rem;
  font-weight: 900;
}

.evaluation-warning {
  margin: 0;
  color: #7b2f24;
  font-size: 0.82rem;
  font-weight: 800;
}

.evaluation-label-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.evaluation-label-grid button,
.evaluation-actions button {
  padding: 0 10px;
}

.evaluation-label-grid button:disabled,
.evaluation-actions button:disabled {
  cursor: not-allowed;
  color: #6c746d;
  border-color: #aeb3ac;
  background: #d7d8cd;
}

.evaluation-actions {
  display: flex;
  gap: 8px;
}
```

In the existing `@media (max-width: 760px)` block, add:

```css
.evaluation-panel {
  top: auto;
  right: 16px;
  bottom: 16px;
  left: 16px;
  width: auto;
}
```

- [ ] **Step 5: Run UI test to verify it passes**

Run:

```bash
npm test -- src/components/EvaluationPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add src/components/EvaluationPanel.tsx src/components/EvaluationPanel.test.tsx src/styles.css
git commit -m "feat: add local evaluation panel"
```

Expected: commit succeeds. If `src/styles.css` still contains older uncommitted edits, review `git diff src/styles.css` before committing.

---

### Task 4: Integrate Evaluation Harness Into Test Mode

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/TestScreen.tsx`
- Modify: `src/components/TestScreen.test.tsx`

- [ ] **Step 1: Write failing TestScreen integration test**

Append to `src/components/TestScreen.test.tsx`:

```tsx
it("renders evaluation controls when provided", () => {
  render(
    <TestScreen
      displayState="green"
      attention={attention}
      smoother={{
        displayState: "green",
        rawState: "looking",
        awayDurationMs: 0
      }}
      evaluation={{
        samples: [],
        summary: {
          totalSamples: 0,
          falseLookingRate: null,
          falseAwayRate: null,
          labels: {
            "screen-center": emptyEvaluationLabel(),
            "screen-bottom": emptyEvaluationLabel(),
            keyboard: emptyEvaluationLabel(),
            "off-left": emptyEvaluationLabel(),
            "off-right": emptyEvaluationLabel(),
            "lean-left": emptyEvaluationLabel(),
            "lean-right": emptyEvaluationLabel(),
            "low-light": emptyEvaluationLabel()
          }
        },
        onCapture: vi.fn(),
        onClear: vi.fn(),
        onExport: vi.fn()
      }}
      onRecalibrate={vi.fn()}
    />
  );

  expect(screen.getByRole("button", { name: "Evaluate" })).toBeInTheDocument();
});

function emptyEvaluationLabel() {
  return {
    sampleCount: 0,
    lookingPercent: 0,
    unknownPercent: 0,
    awayPercent: 0,
    faceMissingPercent: 0,
    medianTrackingScore: null,
    medianKeyboardScore: null
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/components/TestScreen.test.tsx
```

Expected: FAIL because `TestScreen` does not accept an `evaluation` prop.

- [ ] **Step 3: Add evaluation prop to TestScreen**

Modify `src/components/TestScreen.tsx` imports:

```ts
import type {
  EvaluationLabel,
  EvaluationSample,
  EvaluationSummary
} from "../domain/evaluation";
import { EvaluationPanel } from "./EvaluationPanel";
```

Add props:

```ts
type EvaluationControls = {
  samples: EvaluationSample[];
  summary: EvaluationSummary;
  disabledReason?: string;
  onCapture: (label: EvaluationLabel) => void;
  onClear: () => void;
  onExport: () => void;
};

type TestScreenProps = {
  displayState: TestDisplayState;
  attention: AttentionResult | null;
  smoother: SmootherSnapshot | null;
  evaluation?: EvaluationControls;
  onRecalibrate: () => void;
};
```

Render the panel near the recalibrate button:

```tsx
{evaluation ? <EvaluationPanel {...evaluation} /> : null}
```

- [ ] **Step 4: Run TestScreen test to verify it passes**

Run:

```bash
npm test -- src/components/TestScreen.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Add evaluation state and handlers to App**

Modify `src/App.tsx` imports:

```ts
import {
  addEvaluationSample,
  createEvaluationExport,
  summarizeEvaluation,
  type EvaluationLabel,
  type EvaluationSample
} from "./domain/evaluation";
```

Add state near the existing attention state:

```ts
const [evaluationSamples, setEvaluationSamples] = useState<EvaluationSample[]>([]);
```

Add derived summary:

```ts
const evaluationSummary = summarizeEvaluation(evaluationSamples);
```

Add capture, clear, and export handlers:

```ts
const captureEvaluationSample = useCallback(
  (label: EvaluationLabel) => {
    if (!attention || !smootherSnapshot) {
      return;
    }

    setEvaluationSamples((samples) =>
      addEvaluationSample(samples, {
        label,
        timestampMs: latestFeatures?.timestampMs ?? performance.now(),
        features: latestFeatures,
        attention,
        smootherSnapshot
      })
    );
  },
  [attention, latestFeatures, smootherSnapshot]
);

const clearEvaluationSamples = useCallback(() => {
  setEvaluationSamples([]);
}, []);

const exportEvaluationSamples = useCallback(() => {
  const payload = createEvaluationExport(evaluationSamples);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `local-eye-tracking-evaluation-${payload.createdAtMs}.json`;
  link.click();
  URL.revokeObjectURL(url);
}, [evaluationSamples]);
```

Clear samples when calibration starts:

```ts
const beginCalibration = useCallback(() => {
  resetTestingState();
  setEvaluationSamples([]);
  setProfile(null);
  setMode("calibration");
}, [resetTestingState]);
```

Pass evaluation controls to `TestScreen`:

```tsx
<TestScreen
  displayState={displayState}
  attention={attention}
  smoother={smootherSnapshot}
  evaluation={{
    samples: evaluationSamples,
    summary: evaluationSummary,
    disabledReason:
      attention && smootherSnapshot ? undefined : "Waiting for a live tracking result",
    onCapture: captureEvaluationSample,
    onClear: clearEvaluationSamples,
    onExport: exportEvaluationSamples
  }}
  onRecalibrate={beginCalibration}
/>
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/domain/statePipeline.test.ts src/domain/evaluation.test.ts src/components/EvaluationPanel.test.tsx src/components/TestScreen.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

Run:

```bash
git add src/App.tsx src/components/TestScreen.tsx src/components/TestScreen.test.tsx
git commit -m "feat: wire evaluation harness into test mode"
```

Expected: commit succeeds. If older uncommitted changes are present in these paths, inspect the staged diff before committing.

---

### Task 5: Full Verification

**Files:**
- No source edits unless verification reveals a bug.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: PASS with all test files green.

- [ ] **Step 2: Build production bundle**

Run:

```bash
npm run build
```

Expected: PASS with TypeScript and Vite build complete.

- [ ] **Step 3: Start or reuse the local dev server**

Run:

```bash
curl -I --max-time 2 http://127.0.0.1:5173/
```

Expected: HTTP 200 if the existing Vite server is running.

If it is not running, start it:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite serves `http://127.0.0.1:5173/`.

- [ ] **Step 4: Browser smoke test**

Open `http://127.0.0.1:5173/` in the in-app browser.

Expected:

- Setup screen renders.
- Camera permission flow still works.
- Calibration can start when face tracking is ready.
- Test mode shows green/red feedback.
- `Evaluate` opens a secondary panel.
- Label buttons are disabled before the first live attention result and enabled after one exists.
- Capturing `Screen center` increments its count.
- Capturing `Keyboard` increments its count.
- `Export JSON` downloads a JSON file without network calls.
- `Recalibrate` clears evaluation samples.

- [ ] **Step 5: Final repository check**

Run:

```bash
git status --short
```

Expected: only intentionally uncommitted work remains. If this implementation is being shipped now, commit remaining intended changes:

```bash
git add src/domain/statePipeline.ts src/domain/statePipeline.test.ts src/domain/evaluation.ts src/domain/evaluation.test.ts src/components/EvaluationPanel.tsx src/components/EvaluationPanel.test.tsx src/App.tsx src/components/TestScreen.tsx src/components/TestScreen.test.tsx src/styles.css
git commit -m "feat: add local attention evaluation harness"
```

Expected: final feature commit succeeds if task-level commits were not already created.

---

## Self-Review

- Spec coverage: Task 1 implements raw-state preservation; Task 2 implements local labeled samples and metrics; Task 3 implements the secondary harness UI; Task 4 integrates capture/export/clear behavior; Task 5 verifies tests, build, browser behavior, and local-only JSON export.
- Scope check: The plan does not add new gaze libraries, persistence, network calls, teacher dashboards, or exact gaze-cursor prediction.
- Type consistency: `EvaluationLabel`, `EvaluationSample`, and `EvaluationSummary` are defined in `src/domain/evaluation.ts` and reused by `EvaluationPanel`, `TestScreen`, and `App`.
