# Local Learned Classifier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only learned screen-vs-keyboard classifier trained fresh from calibration samples.

**Architecture:** Create a small domain helper that builds a nearest-centroid model from calibration samples and classifies live frames with normalized screen/keyboard distances. Wire that model into `CalibrationProfile`, let `classifyAttention()` prefer learned screen-vs-keyboard decisions after side-gaze guardrails, and expose optional learned diagnostics through the existing diagnostics/evaluation surfaces.

**Tech Stack:** React, TypeScript, Vite, Vitest, existing MediaPipe-derived `FrameFeatures`, existing calibration/classifier/evaluation modules.

---

## File Structure

- Create `src/domain/learnedClassifier.ts`
  - Owns learned feature subset, robust model construction, learned distance calculation, keyboard score, margin, and learned decision output.
- Create `src/domain/learnedClassifier.test.ts`
  - Unit tests for model creation, feature selection, distance behavior, ambiguous decisions, and malformed model fallback.
- Modify `src/domain/types.ts`
  - Add `LearnedAttentionModel`, learned diagnostics on `AttentionResult`, and optional `learnedModel` on `CalibrationProfile`.
- Modify `src/domain/calibration.ts`
  - Build `learnedModel` from the existing screen and keyboard calibration samples.
- Modify `src/domain/calibration.test.ts`
  - Prove calibration creates or omits the learned model correctly.
- Modify `src/domain/classifier.ts`
  - Integrate learned decisions after side-gaze guardrails and before legacy keyboard projection/fallback thresholds.
- Modify `src/domain/classifier.test.ts`
  - Prove learned keyboard glances become `away`, screen-like frames stay `looking`, ambiguous frames become `unknown`, and invalid models fall back.
- Modify `src/domain/evaluation.ts`
  - Copy learned diagnostics into evaluation samples and compute learned median summaries.
- Modify `src/domain/evaluation.test.ts`
  - Prove learned diagnostics export and summarize correctly.
- Modify `scripts/lib/evaluation-analysis.mjs`
  - Include learned diagnostic medians in CLI analysis when present.
- Modify `scripts/analyze-evaluation.test.mjs`
  - Prove analyzer output includes learned diagnostic columns.
- Modify `src/components/TestScreen.tsx`
  - Show learned diagnostics in the compact diagnostics panel when available.
- Modify `src/components/TestScreen.test.tsx`
  - Prove learned diagnostics render.
- Modify `README.md`
  - Mention that calibration now trains a small local in-memory classifier.

---

### Task 1: Learned Model Domain Helper

**Files:**
- Create: `src/domain/learnedClassifier.ts`
- Create: `src/domain/learnedClassifier.test.ts`
- Modify: `src/domain/types.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/learnedClassifier.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  LEARNED_FEATURE_KEYS,
  buildLearnedAttentionModel,
  classifyWithLearnedModel
} from "./learnedClassifier";
import type { FrameFeatures } from "./types";

function frame(overrides: Partial<FrameFeatures> = {}): FrameFeatures {
  return {
    timestampMs: 1_000,
    faceDetected: true,
    pitch: 0.42,
    yaw: 0.05,
    eyeVertical: 0.5,
    eyeHorizontal: 0.5,
    leftEyeVertical: 0.5,
    rightEyeVertical: 0.5,
    leftEyeHorizontal: 0.5,
    rightEyeHorizontal: 0.5,
    leftEyeOpenness: 0.06,
    rightEyeOpenness: 0.06,
    faceCenterX: 0.5,
    faceCenterY: 0.45,
    faceScale: 0.62,
    ...overrides
  };
}

function screenSamples(): FrameFeatures[] {
  return Array.from({ length: 16 }, (_, index) =>
    frame({
      timestampMs: 1_000 + index,
      eyeVertical: 0.5 + index * 0.0005,
      leftEyeVertical: 0.5 + index * 0.0005,
      rightEyeVertical: 0.5 + index * 0.0005,
      faceCenterX: 0.45 + index * 0.01,
      faceScale: 0.58 + index * 0.01
    })
  );
}

function keyboardSamples(): FrameFeatures[] {
  return Array.from({ length: 16 }, (_, index) =>
    frame({
      timestampMs: 2_000 + index,
      eyeVertical: 0.68 + index * 0.0005,
      leftEyeVertical: 0.68 + index * 0.0005,
      rightEyeVertical: 0.68 + index * 0.0005,
      faceCenterX: 0.45 + index * 0.01,
      faceScale: 0.58 + index * 0.01
    })
  );
}

describe("learnedClassifier", () => {
  it("uses gaze-attention features and excludes face placement features", () => {
    expect(LEARNED_FEATURE_KEYS).toContain("eyeVertical");
    expect(LEARNED_FEATURE_KEYS).toContain("leftEyeVertical");
    expect(LEARNED_FEATURE_KEYS).not.toContain("faceCenterX");
    expect(LEARNED_FEATURE_KEYS).not.toContain("faceCenterY");
    expect(LEARNED_FEATURE_KEYS).not.toContain("faceScale");
  });

  it("builds a learned screen-vs-keyboard model from calibration samples", () => {
    const model = buildLearnedAttentionModel(screenSamples(), keyboardSamples());

    expect(model).not.toBeNull();
    expect(model?.version).toBe(1);
    expect(model?.featureKeys).toEqual([...LEARNED_FEATURE_KEYS]);
    expect(model?.keyboardSeparation).toBeGreaterThan(0.75);
    expect(model?.screenRadius).toBeGreaterThanOrEqual(0);
    expect(model?.keyboardRadius).toBeGreaterThanOrEqual(0);
  });

  it("classifies keyboard-like eye-only glances as keyboard", () => {
    const model = buildLearnedAttentionModel(screenSamples(), keyboardSamples());
    expect(model).not.toBeNull();

    const decision = classifyWithLearnedModel(
      frame({
        eyeVertical: 0.675,
        leftEyeVertical: 0.675,
        rightEyeVertical: 0.675,
        faceCenterX: 0.9,
        faceScale: 0.9
      }),
      model!
    );

    expect(decision?.state).toBe("keyboard");
    expect(decision?.keyboardScore).toBeGreaterThan(0.6);
    expect(decision?.margin).toBeGreaterThan(0.15);
  });

  it("classifies screen-like frames as screen despite face placement changes", () => {
    const model = buildLearnedAttentionModel(screenSamples(), keyboardSamples());
    expect(model).not.toBeNull();

    const decision = classifyWithLearnedModel(
      frame({
        eyeVertical: 0.51,
        leftEyeVertical: 0.51,
        rightEyeVertical: 0.51,
        faceCenterX: 0.92,
        faceCenterY: 0.88,
        faceScale: 0.9
      }),
      model!
    );

    expect(decision?.state).toBe("screen");
    expect(decision?.keyboardScore).toBeLessThan(0.4);
    expect(decision?.margin).toBeLessThan(-0.15);
  });

  it("returns unknown for ambiguous frames between screen and keyboard", () => {
    const model = buildLearnedAttentionModel(screenSamples(), keyboardSamples());
    expect(model).not.toBeNull();

    const decision = classifyWithLearnedModel(
      frame({
        eyeVertical: 0.59,
        leftEyeVertical: 0.59,
        rightEyeVertical: 0.59
      }),
      model!
    );

    expect(decision?.state).toBe("unknown");
    expect(Math.abs(decision?.margin ?? 99)).toBeLessThan(0.2);
  });

  it("returns null when model separation is weak or required values are invalid", () => {
    const weakModel = buildLearnedAttentionModel(screenSamples(), screenSamples());
    expect(weakModel).not.toBeNull();

    expect(classifyWithLearnedModel(frame(), weakModel!)).toBeNull();

    const strongModel = buildLearnedAttentionModel(screenSamples(), keyboardSamples());
    expect(strongModel).not.toBeNull();
    expect(classifyWithLearnedModel(frame({ eyeVertical: Number.NaN }), strongModel!)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run:

```bash
npm test -- src/domain/learnedClassifier.test.ts
```

Expected: FAIL because `src/domain/learnedClassifier.ts` does not exist.

- [ ] **Step 3: Add learned model types**

Modify `src/domain/types.ts`:

```ts
export type LearnedAttentionClass = "screen" | "keyboard";

export type LearnedAttentionModel = {
  version: 1;
  featureKeys: FeatureKey[];
  screenCenter: FeatureVector;
  keyboardCenter: FeatureVector;
  scale: FeatureVector;
  screenRadius: number;
  keyboardRadius: number;
  keyboardSeparation: number;
};
```

No other type fields are needed in this task.

- [ ] **Step 4: Implement the learned helper**

Create `src/domain/learnedClassifier.ts`:

```ts
import {
  FEATURE_KEYS,
  type FeatureKey,
  type FeatureVector,
  type FrameFeatures,
  type LearnedAttentionModel
} from "./types";

export const LEARNED_FEATURE_KEYS = [
  "pitch",
  "yaw",
  "eyeVertical",
  "eyeHorizontal",
  "leftEyeVertical",
  "rightEyeVertical",
  "leftEyeHorizontal",
  "rightEyeHorizontal",
  "leftEyeOpenness",
  "rightEyeOpenness"
] as const satisfies readonly FeatureKey[];

export const LEARNED_MIN_SEPARATION = 0.75;
const LEARNED_MARGIN_THRESHOLD = 0.15;
const KEYBOARD_SCORE_THRESHOLD = 0.6;
const SCREEN_SCORE_THRESHOLD = 0.4;

const LEARNED_TOLERANCE_FLOORS: FeatureVector = {
  pitch: 0.04,
  yaw: 0.04,
  eyeVertical: 0.035,
  eyeHorizontal: 0.04,
  faceCenterX: 0.08,
  faceCenterY: 0.08,
  faceScale: 0.06,
  leftEyeVertical: 0.035,
  rightEyeVertical: 0.035,
  leftEyeHorizontal: 0.04,
  rightEyeHorizontal: 0.04,
  leftEyeOpenness: 0.015,
  rightEyeOpenness: 0.015
};

export type LearnedAttentionDecision = {
  state: "screen" | "keyboard" | "unknown";
  screenDistance: number;
  keyboardDistance: number;
  keyboardScore: number;
  margin: number;
  modelSeparation: number;
};

export function buildLearnedAttentionModel(
  screenSamples: FrameFeatures[],
  keyboardSamples: FrameFeatures[]
): LearnedAttentionModel | null {
  const validScreenSamples = validSamples(screenSamples);
  const validKeyboardSamples = validSamples(keyboardSamples);

  if (validScreenSamples.length === 0 || validKeyboardSamples.length === 0) {
    return null;
  }

  const screenCenter = vectorFromSamples(validScreenSamples);
  const keyboardCenter = vectorFromSamples(validKeyboardSamples);
  const scale = scaleFromSamples([...validScreenSamples, ...validKeyboardSamples]);
  const keyboardSeparation = distanceBetween(screenCenter, keyboardCenter, scale);
  const screenRadius = median(
    validScreenSamples.map((sample) => distanceBetween(sample, screenCenter, scale))
  );
  const keyboardRadius = median(
    validKeyboardSamples.map((sample) => distanceBetween(sample, keyboardCenter, scale))
  );

  return {
    version: 1,
    featureKeys: [...LEARNED_FEATURE_KEYS],
    screenCenter,
    keyboardCenter,
    scale,
    screenRadius,
    keyboardRadius,
    keyboardSeparation
  };
}

export function classifyWithLearnedModel(
  features: FrameFeatures,
  model: LearnedAttentionModel | undefined
): LearnedAttentionDecision | null {
  if (!isUsableModel(model) || !hasFiniteLearnedFeatures(features, model.featureKeys)) {
    return null;
  }

  const screenDistance = distanceBetween(features, model.screenCenter, model.scale, model.featureKeys);
  const keyboardDistance = distanceBetween(
    features,
    model.keyboardCenter,
    model.scale,
    model.featureKeys
  );
  const distanceTotal = screenDistance + keyboardDistance;
  const keyboardScore = distanceTotal > 0 ? screenDistance / distanceTotal : 0.5;
  const margin = screenDistance - keyboardDistance;

  if (keyboardScore >= KEYBOARD_SCORE_THRESHOLD && margin >= LEARNED_MARGIN_THRESHOLD) {
    return {
      state: "keyboard",
      screenDistance,
      keyboardDistance,
      keyboardScore,
      margin,
      modelSeparation: model.keyboardSeparation
    };
  }

  if (keyboardScore <= SCREEN_SCORE_THRESHOLD && margin <= -LEARNED_MARGIN_THRESHOLD) {
    return {
      state: "screen",
      screenDistance,
      keyboardDistance,
      keyboardScore,
      margin,
      modelSeparation: model.keyboardSeparation
    };
  }

  return {
    state: "unknown",
    screenDistance,
    keyboardDistance,
    keyboardScore,
    margin,
    modelSeparation: model.keyboardSeparation
  };
}

function isUsableModel(
  model: LearnedAttentionModel | undefined
): model is LearnedAttentionModel {
  return Boolean(
    model &&
      model.version === 1 &&
      Array.isArray(model.featureKeys) &&
      model.featureKeys.length > 0 &&
      Number.isFinite(model.keyboardSeparation) &&
      model.keyboardSeparation >= LEARNED_MIN_SEPARATION &&
      model.featureKeys.every(
        (key) =>
          FEATURE_KEYS.includes(key) &&
          Number.isFinite(model.screenCenter[key]) &&
          Number.isFinite(model.keyboardCenter[key]) &&
          Number.isFinite(model.scale[key]) &&
          model.scale[key] > 0
      )
  );
}

function validSamples(samples: FrameFeatures[]): FrameFeatures[] {
  return samples.filter(
    (sample) => sample.faceDetected && hasFiniteLearnedFeatures(sample, LEARNED_FEATURE_KEYS)
  );
}

function hasFiniteLearnedFeatures(
  sample: FrameFeatures,
  featureKeys: readonly FeatureKey[]
): boolean {
  return featureKeys.every((key) => Number.isFinite(sample[key]));
}

function vectorFromSamples(samples: FrameFeatures[]): FeatureVector {
  return Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, median(samples.map((sample) => sample[key]))])
  ) as FeatureVector;
}

function scaleFromSamples(samples: FrameFeatures[]): FeatureVector {
  const center = vectorFromSamples(samples);

  return Object.fromEntries(
    FEATURE_KEYS.map((key) => {
      const deviations = samples.map((sample) => Math.abs(sample[key] - center[key]));
      const robustScale = percentileValue(deviations, 0.95) * 1.8;

      return [key, Math.max(robustScale, LEARNED_TOLERANCE_FLOORS[key])];
    })
  ) as FeatureVector;
}

function distanceBetween(
  left: FeatureVector,
  right: FeatureVector,
  scale: FeatureVector,
  featureKeys: readonly FeatureKey[] = LEARNED_FEATURE_KEYS
): number {
  const total = featureKeys.reduce((sum, key) => {
    const normalized = Math.abs(left[key] - right[key]) / Math.max(scale[key], 0.0001);

    return sum + normalized ** 2;
  }, 0);

  return Math.sqrt(total / featureKeys.length);
}

function median(values: number[]): number {
  const sorted = [...values]
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length === 0) {
    return 0;
  }

  if (sorted.length % 2 === 1) {
    return sorted[middleIndex];
  }

  return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
}

function percentileValue(values: number[], percentile: number): number {
  const sorted = [...values]
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (sorted.length === 0) {
    return 0;
  }

  const index = Math.ceil(percentile * sorted.length) - 1;
  const boundedIndex = Math.min(Math.max(index, 0), sorted.length - 1);

  return sorted[boundedIndex];
}
```

- [ ] **Step 5: Run the learned helper tests**

Run:

```bash
npm test -- src/domain/learnedClassifier.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add src/domain/types.ts src/domain/learnedClassifier.ts src/domain/learnedClassifier.test.ts
git commit -m "feat: add local learned classifier helper"
```

---

### Task 2: Calibration Profile Learned Model

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/calibration.ts`
- Modify: `src/domain/calibration.test.ts`

- [ ] **Step 1: Write the failing calibration tests**

Append these tests inside the existing `describe("calibration", () => { ... })` block in `src/domain/calibration.test.ts`:

```ts
  it("builds a learned model when keyboard calibration samples are available", () => {
    const calibrationSamples = {
      ...samplesByPoint(sample),
      keyboard: Array.from({ length: 14 }, (_, index) => ({
        ...sample("keyboard", index),
        eyeVertical: 0.7 + index * 0.001,
        leftEyeVertical: 0.7 + index * 0.001,
        rightEyeVertical: 0.7 + index * 0.001,
        faceCenterX: 0.8,
        faceScale: 0.9
      }))
    };

    const result = buildCalibrationProfile(calibrationSamples);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.learnedModel).toBeDefined();
    expect(result.profile.learnedModel?.keyboardSeparation).toBeGreaterThan(0.75);
    expect(result.profile.learnedModel?.featureKeys).not.toContain("faceCenterX");
    expect(result.profile.learnedModel?.featureKeys).not.toContain("faceScale");
  });

  it("omits the learned model when keyboard calibration is not part of the profile", () => {
    const result = buildCalibrationProfile(samplesByPoint(sample));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.keyboardCenter).toBeUndefined();
    expect(result.profile.learnedModel).toBeUndefined();
  });
```

- [ ] **Step 2: Run calibration tests to verify they fail**

Run:

```bash
npm test -- src/domain/calibration.test.ts
```

Expected: FAIL because `CalibrationProfile` has no `learnedModel` field and `buildCalibrationProfile()` does not build one.

- [ ] **Step 3: Add `learnedModel` to the profile type**

Modify `src/domain/types.ts`:

```ts
export type CalibrationProfile = {
  createdAtMs: number;
  minValidSamplesPerPoint: number;
  points: CalibrationPointId[];
  center: FeatureVector;
  tolerance: FeatureVector;
  keyboardCenter?: FeatureVector;
  keyboardTolerance?: FeatureVector;
  keyboardSeparation?: number;
  keyboardQuality?: KeyboardCalibrationQuality;
  learnedModel?: LearnedAttentionModel;
};
```

- [ ] **Step 4: Build the learned model during calibration**

Modify `src/domain/calibration.ts`:

```ts
import { buildLearnedAttentionModel } from "./learnedClassifier";
```

Inside `buildCalibrationProfile()`, after `keyboardQuality` is computed, add:

```ts
  const learnedModel =
    keyboardSamples.length > 0
      ? buildLearnedAttentionModel(samples, keyboardSamples) ?? undefined
      : undefined;
```

Then include `learnedModel` in the returned `profile`:

```ts
      keyboardSeparation,
      keyboardQuality,
      learnedModel
```

- [ ] **Step 5: Run calibration and learned helper tests**

Run:

```bash
npm test -- src/domain/calibration.test.ts src/domain/learnedClassifier.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add src/domain/types.ts src/domain/calibration.ts src/domain/calibration.test.ts
git commit -m "feat: build learned model during calibration"
```

---

### Task 3: Classifier Integration

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/classifier.ts`
- Modify: `src/domain/classifier.test.ts`

- [ ] **Step 1: Write failing classifier tests**

Add this import to `src/domain/classifier.test.ts`:

```ts
import { buildLearnedAttentionModel } from "./learnedClassifier";
```

Add these helpers below the existing `frame()` helper:

```ts
function learnedScreenSamples(): FrameFeatures[] {
  return Array.from({ length: 16 }, (_, index) =>
    frame({
      timestampMs: 3_000 + index,
      eyeVertical: 0.5 + index * 0.0005,
      leftEyeVertical: 0.5 + index * 0.0005,
      rightEyeVertical: 0.5 + index * 0.0005,
      faceCenterX: 0.45 + index * 0.01,
      faceScale: 0.58 + index * 0.01
    })
  );
}

function learnedKeyboardSamples(): FrameFeatures[] {
  return Array.from({ length: 16 }, (_, index) =>
    frame({
      timestampMs: 4_000 + index,
      eyeVertical: 0.68 + index * 0.0005,
      leftEyeVertical: 0.68 + index * 0.0005,
      rightEyeVertical: 0.68 + index * 0.0005,
      faceCenterX: 0.45 + index * 0.01,
      faceScale: 0.58 + index * 0.01
    })
  );
}

function learnedProfile(): CalibrationProfile {
  const learnedModel = buildLearnedAttentionModel(
    learnedScreenSamples(),
    learnedKeyboardSamples()
  );

  if (!learnedModel) {
    throw new Error("Expected learned model");
  }

  return {
    ...profile,
    learnedModel
  };
}
```

Append these tests inside `describe("classifyAttention", () => { ... })`:

```ts
  it("uses the learned model to classify keyboard-like eye-only glances as away", () => {
    const result = classifyAttention(
      frame({
        pitch: profile.center.pitch,
        yaw: profile.center.yaw,
        eyeVertical: 0.675,
        leftEyeVertical: 0.675,
        rightEyeVertical: 0.675,
        faceCenterX: 0.92,
        faceScale: 0.9
      }),
      learnedProfile()
    );

    expect(result.rawState).toBe("away");
    expect(result.trackingScore).toBe(0);
    expect(result.learnedKeyboardScore).toBeGreaterThan(0.6);
    expect(result.learnedMargin).toBeGreaterThan(0.15);
    expect(result.learnedModelSeparation).toBeGreaterThan(0.75);
  });

  it("uses the learned model to keep screen-like frames looking despite face placement changes", () => {
    const result = classifyAttention(
      frame({
        eyeVertical: 0.51,
        leftEyeVertical: 0.51,
        rightEyeVertical: 0.51,
        faceCenterX: 0.92,
        faceCenterY: 0.88,
        faceScale: 0.9
      }),
      learnedProfile()
    );

    expect(result.rawState).toBe("looking");
    expect(result.learnedKeyboardScore).toBeLessThan(0.4);
    expect(result.learnedMargin).toBeLessThan(-0.15);
  });

  it("uses the learned model to mark screen-vs-keyboard ambiguous frames unknown", () => {
    const result = classifyAttention(
      frame({
        eyeVertical: 0.59,
        leftEyeVertical: 0.59,
        rightEyeVertical: 0.59
      }),
      learnedProfile()
    );

    expect(result.rawState).toBe("unknown");
    expect(result.learnedKeyboardScore).toBeGreaterThan(0.4);
    expect(result.learnedKeyboardScore).toBeLessThan(0.6);
  });

  it("falls back to the existing classifier when the learned model is weak", () => {
    const weakLearnedModel = buildLearnedAttentionModel(
      learnedScreenSamples(),
      learnedScreenSamples()
    );

    const result = classifyAttention(
      frame({ pitch: pitchForDistance(1.66) }),
      {
        ...profile,
        learnedModel: weakLearnedModel ?? undefined
      }
    );

    expect(result.rawState).toBe("away");
    expect(result.learnedKeyboardScore).toBeUndefined();
  });
```

- [ ] **Step 2: Run classifier tests to verify they fail**

Run:

```bash
npm test -- src/domain/classifier.test.ts
```

Expected: FAIL because `AttentionResult` has no learned diagnostic fields and `classifyAttention()` does not use the learned model.

- [ ] **Step 3: Add learned diagnostics to `AttentionResult`**

Modify `src/domain/types.ts`:

```ts
export type AttentionResult = {
  rawState: RawAttentionState;
  confidence: number;
  distance: number;
  trackingScore: number;
  screenDistance?: number;
  sideGazeScore?: number;
  sideGazeDirection?: "left" | "right";
  keyboardDistance?: number;
  keyboardScore?: number;
  keyboardSeparation?: number;
  keyboardQuality?: KeyboardCalibrationQuality;
  learnedScreenDistance?: number;
  learnedKeyboardDistance?: number;
  learnedKeyboardScore?: number;
  learnedMargin?: number;
  learnedModelSeparation?: number;
};
```

- [ ] **Step 4: Integrate learned decisions into the classifier**

Modify imports in `src/domain/classifier.ts`:

```ts
import { classifyWithLearnedModel } from "./learnedClassifier";
```

Add this helper near `keyboardDiagnostics()`:

```ts
function learnedDiagnostics(features: FrameFeatures, profile: CalibrationProfile) {
  const decision = classifyWithLearnedModel(features, profile.learnedModel);

  if (!decision) {
    return null;
  }

  return {
    decision,
    learnedScreenDistance: decision.screenDistance,
    learnedKeyboardDistance: decision.keyboardDistance,
    learnedKeyboardScore: decision.keyboardScore,
    learnedMargin: decision.margin,
    learnedModelSeparation: decision.modelSeparation
  };
}
```

Inside `classifyAttention()`, after `const sideGaze = sideGazeDiagnostics(features, profile);`, add:

```ts
  const learned = learnedDiagnostics(features, profile);
```

In every existing return after that point, spread learned diagnostics when present:

```ts
      ...(learned
        ? {
            learnedScreenDistance: learned.learnedScreenDistance,
            learnedKeyboardDistance: learned.learnedKeyboardDistance,
            learnedKeyboardScore: learned.learnedKeyboardScore,
            learnedMargin: learned.learnedMargin,
            learnedModelSeparation: learned.learnedModelSeparation
          }
        : {})
```

Before the legacy keyboard projection block, add:

```ts
  if (learned?.decision.state === "keyboard") {
    return {
      rawState: "away",
      confidence: clamp01(learned.learnedKeyboardScore),
      distance,
      trackingScore: 0,
      screenDistance: distance,
      ...sideGaze,
      ...keyboard,
      learnedScreenDistance: learned.learnedScreenDistance,
      learnedKeyboardDistance: learned.learnedKeyboardDistance,
      learnedKeyboardScore: learned.learnedKeyboardScore,
      learnedMargin: learned.learnedMargin,
      learnedModelSeparation: learned.learnedModelSeparation
    };
  }

  if (learned?.decision.state === "screen") {
    return {
      rawState: "looking",
      confidence: clamp01(1 - learned.learnedKeyboardScore),
      distance,
      trackingScore,
      screenDistance: distance,
      ...sideGaze,
      ...keyboard,
      learnedScreenDistance: learned.learnedScreenDistance,
      learnedKeyboardDistance: learned.learnedKeyboardDistance,
      learnedKeyboardScore: learned.learnedKeyboardScore,
      learnedMargin: learned.learnedMargin,
      learnedModelSeparation: learned.learnedModelSeparation
    };
  }

  if (learned?.decision.state === "unknown") {
    return {
      rawState: "unknown",
      confidence: clamp01(1 - Math.abs(learned.learnedKeyboardScore - 0.5) * 2),
      distance,
      trackingScore,
      screenDistance: distance,
      ...sideGaze,
      ...keyboard,
      learnedScreenDistance: learned.learnedScreenDistance,
      learnedKeyboardDistance: learned.learnedKeyboardDistance,
      learnedKeyboardScore: learned.learnedKeyboardScore,
      learnedMargin: learned.learnedMargin,
      learnedModelSeparation: learned.learnedModelSeparation
    };
  }
```

Keep the existing side-gaze guardrail before these learned-model returns.

- [ ] **Step 5: Run classifier tests**

Run:

```bash
npm test -- src/domain/classifier.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run core domain tests**

Run:

```bash
npm test -- src/domain/learnedClassifier.test.ts src/domain/calibration.test.ts src/domain/classifier.test.ts src/domain/statePipeline.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add src/domain/types.ts src/domain/classifier.ts src/domain/classifier.test.ts
git commit -m "feat: use learned classifier in attention decisions"
```

---

### Task 4: Diagnostics, Evaluation, And Analyzer Output

**Files:**
- Modify: `src/domain/evaluation.ts`
- Modify: `src/domain/evaluation.test.ts`
- Modify: `src/components/TestScreen.tsx`
- Modify: `src/components/TestScreen.test.tsx`
- Modify: `scripts/lib/evaluation-analysis.mjs`
- Modify: `scripts/analyze-evaluation.test.mjs`

- [ ] **Step 1: Write failing evaluation tests**

Modify the `attention()` helper in `src/domain/evaluation.test.ts` to include learned diagnostics:

```ts
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
    keyboardQuality: "strong",
    learnedScreenDistance: 0.35,
    learnedKeyboardDistance: 1.4,
    learnedKeyboardScore: 0.2,
    learnedMargin: -1.05,
    learnedModelSeparation: 1.9
  };
}
```

In the existing `"adds labeled samples with feature and attention diagnostics"` test, add:

```ts
    expect(samples[0].learnedKeyboardScore).toBe(0.2);
    expect(samples[0].learnedModelSeparation).toBe(1.9);
```

Append this test:

```ts
  it("summarizes learned keyboard score medians by label", () => {
    const samples = [
      ...addEvaluationSample([], {
        label: "keyboard",
        timestampMs: 100,
        features,
        attention: {
          ...attention("away", 0.25),
          learnedKeyboardScore: 0.9
        },
        smootherSnapshot: { displayState: "red", rawState: "away", awayDurationMs: 900 }
      }),
      ...addEvaluationSample([], {
        label: "keyboard",
        timestampMs: 120,
        features,
        attention: {
          ...attention("away", 0.25),
          learnedKeyboardScore: 0.7
        },
        smootherSnapshot: { displayState: "red", rawState: "away", awayDurationMs: 900 }
      })
    ];

    const summary = summarizeEvaluation(samples);

    expect(summary.labels.keyboard.medianLearnedKeyboardScore).toBe(0.8);
  });
```

- [ ] **Step 2: Write failing UI diagnostics test**

Modify the `attention` object in `src/components/TestScreen.test.tsx`:

```ts
  learnedScreenDistance: 0.35,
  learnedKeyboardDistance: 1.45,
  learnedKeyboardScore: 0.22,
  learnedMargin: -1.1,
  learnedModelSeparation: 1.9
```

In the `"renders live diagnostics for calibration and keyboard separation"` test, add:

```ts
    expect(screen.getByText("Learned keyboard")).toBeInTheDocument();
    expect(screen.getByText("Learned margin")).toBeInTheDocument();
    expect(screen.getByText("Learned separation")).toBeInTheDocument();
```

- [ ] **Step 3: Write failing analyzer test**

Modify `sample()` in `scripts/analyze-evaluation.test.mjs`:

```js
function sample(label, rawState, trackingScore, keyboardScore, sideGazeScore, learnedKeyboardScore) {
  return {
    id: `${label}-${rawState}-${trackingScore}`,
    timestampMs: 1_000,
    label,
    rawState,
    displayState: rawState === "looking" ? "green" : "red",
    awayDurationMs: rawState === "looking" ? 0 : 900,
    trackingScore,
    ...(keyboardScore === undefined ? {} : { keyboardScore }),
    ...(sideGazeScore === undefined ? {} : { sideGazeScore }),
    ...(learnedKeyboardScore === undefined ? {} : { learnedKeyboardScore })
  };
}
```

In `"formats output with display names and target progress"`, change the two sample calls to include learned scores:

```js
            sample("keyboard", "looking", 0.91, 0.82, undefined, 0.88),
            sample("screen-center", "away", 0.31, 0.2, undefined, 0.3)
```

Add:

```js
    expect(output).toContain("Median learned keyboard");
    expect(output).toContain("0.880");
```

- [ ] **Step 4: Run focused tests to verify they fail**

Run:

```bash
npm test -- src/domain/evaluation.test.ts src/components/TestScreen.test.tsx scripts/analyze-evaluation.test.mjs
```

Expected: FAIL because learned diagnostics are not copied, summarized, rendered, or analyzed.

- [ ] **Step 5: Add learned diagnostics to evaluation samples and summaries**

Modify `src/domain/evaluation.ts`.

Add fields to `EvaluationSample`:

```ts
  learnedScreenDistance?: number;
  learnedKeyboardDistance?: number;
  learnedKeyboardScore?: number;
  learnedMargin?: number;
  learnedModelSeparation?: number;
```

Add fields to `EvaluationSummaryByLabel`:

```ts
  medianLearnedKeyboardScore: number | null;
  medianLearnedModelSeparation: number | null;
```

In `addEvaluationSample()`, copy:

```ts
      learnedScreenDistance: input.attention.learnedScreenDistance,
      learnedKeyboardDistance: input.attention.learnedKeyboardDistance,
      learnedKeyboardScore: input.attention.learnedKeyboardScore,
      learnedMargin: input.attention.learnedMargin,
      learnedModelSeparation: input.attention.learnedModelSeparation
```

In `summarizeLabel()`, add:

```ts
    medianLearnedKeyboardScore: median(labelSamples.map((sample) => sample.learnedKeyboardScore)),
    medianLearnedModelSeparation: median(
      labelSamples.map((sample) => sample.learnedModelSeparation)
    )
```

- [ ] **Step 6: Render learned diagnostics on the test screen**

Modify the `rows` array in `diagnosticsFor()` in `src/components/TestScreen.tsx`:

```ts
    metricRow("Learned screen", attention.learnedScreenDistance),
    metricRow("Learned keyboard", attention.learnedKeyboardDistance),
    metricRow("Learned score", attention.learnedKeyboardScore),
    metricRow("Learned margin", attention.learnedMargin),
    metricRow("Learned separation", attention.learnedModelSeparation)
```

Place these after the existing keyboard diagnostics so the panel keeps the legacy values first.

- [ ] **Step 7: Add learned diagnostics to analyzer summaries**

Modify `scripts/lib/evaluation-analysis.mjs`.

In the table header, add these columns after `"Median keyboard"`:

```js
        "Median learned keyboard",
        "Median learned separation"
```

In each table row, add:

```js
          formatScore(row.medianLearnedKeyboardScore),
          formatScore(row.medianLearnedModelSeparation)
```

In `analyzeLabel()`, add:

```js
    medianLearnedKeyboardScore: median(labelSamples.map((sample) => sample.learnedKeyboardScore)),
    medianLearnedModelSeparation: median(
      labelSamples.map((sample) => sample.learnedModelSeparation)
    )
```

- [ ] **Step 8: Run diagnostics/evaluation tests**

Run:

```bash
npm test -- src/domain/evaluation.test.ts src/components/TestScreen.test.tsx scripts/analyze-evaluation.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit Task 4**

Run:

```bash
git add src/domain/evaluation.ts src/domain/evaluation.test.ts src/components/TestScreen.tsx src/components/TestScreen.test.tsx scripts/lib/evaluation-analysis.mjs scripts/analyze-evaluation.test.mjs
git commit -m "feat: expose learned classifier diagnostics"
```

---

### Task 5: README And Full Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README behavior description**

Modify the paragraph under `## How Tracking Works` in `README.md` from:

```md
The tracker extracts a compact feature vector from each valid webcam frame. Features include head-pose estimates, aggregate eye movement, per-eye horizontal and vertical signals, eye openness, face center, and face scale.
```

To:

```md
The tracker extracts a compact feature vector from each valid webcam frame. Features include head-pose estimates, aggregate eye movement, per-eye horizontal and vertical signals, eye openness, face center, and face scale. During calibration, the app also trains a small in-memory screen-vs-keyboard classifier from numeric calibration features only; webcam frames still stay in the browser and no trained model is uploaded or saved between sessions.
```

Modify the paragraph after the keyboard calibration description from:

```md
During testing, the classifier combines:

- Screen-profile distance.
- Keyboard projection score.
- Keyboard calibration quality.
- Side-gaze score.
- Face presence.
```

To:

```md
During testing, the classifier combines:

- Screen-profile distance.
- Keyboard projection score.
- Learned screen-vs-keyboard classification when calibration quality is usable.
- Keyboard calibration quality.
- Side-gaze score.
- Face presence.
```

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS with all test files passing.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS and `dist/` assets generated.

- [ ] **Step 4: Run whitespace validation**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Commit Task 5**

Run:

```bash
git add README.md
git commit -m "docs: describe local learned classifier"
```

---

## Final Review Checklist

- [ ] `git status --short --branch` shows a clean feature branch.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] `git diff --check` passes.
- [ ] The branch contains focused commits for model helper, calibration, classifier integration, diagnostics, and docs.
- [ ] No backend, persistence, network call, TensorFlow.js, ONNX Runtime, or new model dependency was added.
- [ ] The README privacy promise remains true.
- [ ] Manual test plan is ready: recalibrate, screen center, screen bottom, keyboard/down, off-left, off-right, export evaluation JSON, run `npm run analyze:evaluation -- <export.json>`.

## Execution Notes

This plan intentionally keeps learned training calibration-only. Do not add a "train from evaluation samples" button in this phase. Do not save the learned model to local storage. Do not upload calibration samples or evaluation exports.
