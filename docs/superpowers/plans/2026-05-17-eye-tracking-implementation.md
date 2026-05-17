# Webcam Attention Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only browser app that calibrates against five screen dots, then shows a full-screen green/red attention test for typing students.

**Architecture:** Use a Vite React TypeScript app with core tracking logic kept in testable pure modules. MediaPipe Face Landmarker handles browser face landmarks, while calibration, classification, and smoothing run as local deterministic logic.

**Tech Stack:** React, TypeScript, Vite, Vitest, React Testing Library, MediaPipe Tasks Vision, browser `getUserMedia`.

---

## File Structure

- Create `package.json`: npm scripts and dependencies.
- Create `index.html`: Vite HTML entry.
- Create `tsconfig.json`: TypeScript app configuration.
- Create `tsconfig.node.json`: TypeScript config for Vite config files.
- Create `vite.config.ts`: Vite and Vitest configuration.
- Create `src/test/setup.ts`: React Testing Library setup.
- Create `src/main.tsx`: React root entry.
- Create `src/App.tsx`: app state machine and screen composition.
- Create `src/styles.css`: full-window UI styles.
- Create `src/domain/types.ts`: shared feature, calibration, and attention types.
- Create `src/domain/calibration.ts`: calibration sample validation and profile generation.
- Create `src/domain/calibration.test.ts`: calibration unit tests.
- Create `src/domain/classifier.ts`: binary attention classifier.
- Create `src/domain/classifier.test.ts`: classifier unit tests.
- Create `src/domain/smoothing.ts`: forgiving green/red smoothing state machine.
- Create `src/domain/smoothing.test.ts`: smoothing unit tests.
- Create `src/domain/landmarks.ts`: feature extraction from MediaPipe-style landmarks.
- Create `src/domain/landmarks.test.ts`: landmark feature extraction tests.
- Create `src/tracking/faceTracker.ts`: MediaPipe Face Landmarker wrapper.
- Create `src/hooks/useCamera.ts`: webcam stream hook and camera error mapping.
- Create `src/hooks/useAttentionLoop.ts`: requestAnimationFrame loop for tracker output.
- Create `src/components/SetupScreen.tsx`: permission/model readiness screen.
- Create `src/components/CalibrationScreen.tsx`: five-dot automatic calibration UI.
- Create `src/components/TestScreen.tsx`: full-screen green/red test UI.
- Create `src/components/CameraPreview.tsx`: hidden/compact local video element.

## Task 1: Project Shell And Test Harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Create the package and config files**

Create `package.json`:

```json
{
  "name": "webcam-attention-tracker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview": "vite preview --host 127.0.0.1"
  },
  "dependencies": {
    "@mediapipe/tasks-vision": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@vitejs/plugin-react": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Webcam Attention Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    globals: true
  }
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 2: Create the minimal React entry**

Create `src/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <section className="setup-panel">
        <p className="eyebrow">Local webcam attention tracker</p>
        <h1>Calibrate before testing</h1>
        <p>
          The app will use your webcam locally to learn what looking at the screen looks like,
          then run a green/red attention test.
        </p>
      </section>
    </main>
  );
}
```

Create `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/styles.css`:

```css
:root {
  color: #17211b;
  background: #f4f7f2;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
}

.setup-panel {
  width: min(720px, 100%);
  display: grid;
  gap: 16px;
}

.eyebrow {
  margin: 0;
  color: #486b55;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0;
}

h1,
p {
  margin: 0;
}
```

- [ ] **Step 3: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and npm exits with status `0`.

- [ ] **Step 4: Verify the shell builds**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite finish with status `0`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts src
git commit -m "chore: scaffold webcam attention app"
```

## Task 2: Calibration Profile Logic

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/calibration.ts`
- Create: `src/domain/calibration.test.ts`

- [ ] **Step 1: Write the failing calibration tests**

Create `src/domain/calibration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildCalibrationProfile,
  CALIBRATION_POINTS,
  hasEnoughSamplesForPoint
} from "./calibration";
import type { CalibrationPointId, FrameFeatures } from "./types";

function sample(point: CalibrationPointId, offset: number): FrameFeatures {
  return {
    timestampMs: 1000 + offset,
    faceDetected: true,
    point,
    pitch: 0.42 + offset * 0.001,
    yaw: 0.05 + offset * 0.001,
    eyeVertical: 0.5 + offset * 0.001,
    eyeHorizontal: 0.5,
    faceCenterX: 0.5,
    faceCenterY: 0.45,
    faceScale: 0.62
  };
}

describe("calibration", () => {
  it("defines the five calibration points in screen order", () => {
    expect(CALIBRATION_POINTS.map((point) => point.id)).toEqual([
      "top-left",
      "top-right",
      "bottom-right",
      "bottom-left",
      "center"
    ]);
  });

  it("rejects calibration points with too few valid samples", () => {
    expect(hasEnoughSamplesForPoint([sample("center", 1)], 12)).toBe(false);
    expect(
      hasEnoughSamplesForPoint(
        Array.from({ length: 12 }, (_, index) => sample("center", index)),
        12
      )
    ).toBe(true);
  });

  it("builds a profile with medians and tolerances from every point", () => {
    const samplesByPoint = Object.fromEntries(
      CALIBRATION_POINTS.map((point) => [
        point.id,
        Array.from({ length: 14 }, (_, index) => sample(point.id, index))
      ])
    );

    const result = buildCalibrationProfile(samplesByPoint);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.points).toHaveLength(5);
    expect(result.profile.center.pitch).toBeCloseTo(0.426, 3);
    expect(result.profile.tolerance.pitch).toBeGreaterThan(0.04);
    expect(result.profile.tolerance.faceScale).toBeGreaterThan(0.02);
  });

  it("reports the point that needs retry when samples are insufficient", () => {
    const samplesByPoint = Object.fromEntries(
      CALIBRATION_POINTS.map((point) => [
        point.id,
        point.id === "bottom-left"
          ? Array.from({ length: 3 }, (_, index) => sample(point.id, index))
          : Array.from({ length: 14 }, (_, index) => sample(point.id, index))
      ])
    );

    const result = buildCalibrationProfile(samplesByPoint);

    expect(result).toEqual({
      ok: false,
      reason: "insufficient-samples",
      pointId: "bottom-left"
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/domain/calibration.test.ts
```

Expected: FAIL because `src/domain/calibration.ts` and `src/domain/types.ts` do not exist.

- [ ] **Step 3: Implement shared types and calibration**

Create `src/domain/types.ts`:

```ts
export type CalibrationPointId =
  | "top-left"
  | "top-right"
  | "bottom-right"
  | "bottom-left"
  | "center";

export type FeatureKey =
  | "pitch"
  | "yaw"
  | "eyeVertical"
  | "eyeHorizontal"
  | "faceCenterX"
  | "faceCenterY"
  | "faceScale";

export const FEATURE_KEYS: FeatureKey[] = [
  "pitch",
  "yaw",
  "eyeVertical",
  "eyeHorizontal",
  "faceCenterX",
  "faceCenterY",
  "faceScale"
];

export type FrameFeatures = Record<FeatureKey, number> & {
  timestampMs: number;
  faceDetected: boolean;
  point?: CalibrationPointId;
};

export type FeatureVector = Record<FeatureKey, number>;

export type CalibrationPoint = {
  id: CalibrationPointId;
  label: string;
  xPercent: number;
  yPercent: number;
};

export type CalibrationProfile = {
  createdAtMs: number;
  minValidSamplesPerPoint: number;
  points: CalibrationPointId[];
  center: FeatureVector;
  tolerance: FeatureVector;
};

export type RawAttentionState = "looking" | "away" | "unknown" | "face-missing";

export type AttentionResult = {
  rawState: RawAttentionState;
  confidence: number;
  distance: number;
};
```

Create `src/domain/calibration.ts`:

```ts
import { FEATURE_KEYS, type CalibrationPoint, type CalibrationPointId, type CalibrationProfile, type FeatureKey, type FeatureVector, type FrameFeatures } from "./types";

export const MIN_VALID_SAMPLES_PER_POINT = 12;

export const CALIBRATION_POINTS: CalibrationPoint[] = [
  { id: "top-left", label: "Top left", xPercent: 12, yPercent: 14 },
  { id: "top-right", label: "Top right", xPercent: 88, yPercent: 14 },
  { id: "bottom-right", label: "Bottom right", xPercent: 88, yPercent: 86 },
  { id: "bottom-left", label: "Bottom left", xPercent: 12, yPercent: 86 },
  { id: "center", label: "Center", xPercent: 50, yPercent: 50 }
];

export type SamplesByPoint = Partial<Record<CalibrationPointId, FrameFeatures[]>>;

export type CalibrationBuildResult =
  | { ok: true; profile: CalibrationProfile }
  | { ok: false; reason: "insufficient-samples"; pointId: CalibrationPointId };

const TOLERANCE_FLOORS: FeatureVector = {
  pitch: 0.04,
  yaw: 0.04,
  eyeVertical: 0.035,
  eyeHorizontal: 0.04,
  faceCenterX: 0.08,
  faceCenterY: 0.08,
  faceScale: 0.06
};

export function hasEnoughSamplesForPoint(
  samples: FrameFeatures[] | undefined,
  minValidSamples = MIN_VALID_SAMPLES_PER_POINT
) {
  return (samples ?? []).filter((sample) => sample.faceDetected).length >= minValidSamples;
}

export function buildCalibrationProfile(
  samplesByPoint: SamplesByPoint,
  nowMs = Date.now()
): CalibrationBuildResult {
  for (const point of CALIBRATION_POINTS) {
    if (!hasEnoughSamplesForPoint(samplesByPoint[point.id])) {
      return { ok: false, reason: "insufficient-samples", pointId: point.id };
    }
  }

  const validSamples = CALIBRATION_POINTS.flatMap((point) =>
    (samplesByPoint[point.id] ?? []).filter((sample) => sample.faceDetected)
  );

  const center = vectorFromSamples(validSamples, median);
  const tolerance = FEATURE_KEYS.reduce((accumulator, key) => {
    const deviations = validSamples.map((sample) => Math.abs(sample[key] - center[key]));
    const percentile = percentileValue(deviations, 0.95);
    accumulator[key] = Math.max(percentile * 1.8, TOLERANCE_FLOORS[key]);
    return accumulator;
  }, {} as FeatureVector);

  return {
    ok: true,
    profile: {
      createdAtMs: nowMs,
      minValidSamplesPerPoint: MIN_VALID_SAMPLES_PER_POINT,
      points: CALIBRATION_POINTS.map((point) => point.id),
      center,
      tolerance
    }
  };
}

function vectorFromSamples(
  samples: FrameFeatures[],
  reducer: (values: number[]) => number
): FeatureVector {
  return FEATURE_KEYS.reduce((accumulator, key) => {
    accumulator[key] = reducer(samples.map((sample) => sample[key]));
    return accumulator;
  }, {} as FeatureVector);
}

function median(values: number[]) {
  return percentileValue(values, 0.5);
}

function percentileValue(values: number[], percentile: number) {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * percentile)));
  return sorted[index];
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
npm test -- src/domain/calibration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/domain/calibration.ts src/domain/calibration.test.ts
git commit -m "feat: add calibration profile logic"
```

## Task 3: Attention Classifier

**Files:**
- Create: `src/domain/classifier.ts`
- Create: `src/domain/classifier.test.ts`

- [ ] **Step 1: Write the failing classifier tests**

Create `src/domain/classifier.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyAttention } from "./classifier";
import type { CalibrationProfile, FrameFeatures } from "./types";

const profile: CalibrationProfile = {
  createdAtMs: 1000,
  minValidSamplesPerPoint: 12,
  points: ["top-left", "top-right", "bottom-right", "bottom-left", "center"],
  center: {
    pitch: 0.42,
    yaw: 0.05,
    eyeVertical: 0.5,
    eyeHorizontal: 0.5,
    faceCenterX: 0.5,
    faceCenterY: 0.45,
    faceScale: 0.62
  },
  tolerance: {
    pitch: 0.05,
    yaw: 0.05,
    eyeVertical: 0.04,
    eyeHorizontal: 0.04,
    faceCenterX: 0.1,
    faceCenterY: 0.1,
    faceScale: 0.08
  }
};

function frame(overrides: Partial<FrameFeatures> = {}): FrameFeatures {
  return {
    timestampMs: 2000,
    faceDetected: true,
    pitch: 0.42,
    yaw: 0.05,
    eyeVertical: 0.5,
    eyeHorizontal: 0.5,
    faceCenterX: 0.5,
    faceCenterY: 0.45,
    faceScale: 0.62,
    ...overrides
  };
}

describe("classifyAttention", () => {
  it("classifies calibrated-looking frames as looking", () => {
    expect(classifyAttention(frame(), profile).rawState).toBe("looking");
  });

  it("classifies strong downward posture as away", () => {
    const result = classifyAttention(frame({ pitch: 0.72, eyeVertical: 0.71 }), profile);
    expect(result.rawState).toBe("away");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("classifies borderline frames as unknown", () => {
    expect(classifyAttention(frame({ pitch: 0.49, eyeVertical: 0.56 }), profile).rawState).toBe(
      "unknown"
    );
  });

  it("classifies missing faces separately", () => {
    expect(classifyAttention(frame({ faceDetected: false }), profile)).toEqual({
      rawState: "face-missing",
      confidence: 1,
      distance: Number.POSITIVE_INFINITY
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/domain/classifier.test.ts
```

Expected: FAIL because `src/domain/classifier.ts` does not exist.

- [ ] **Step 3: Implement the classifier**

Create `src/domain/classifier.ts`:

```ts
import { FEATURE_KEYS, type AttentionResult, type CalibrationProfile, type FeatureKey, type FrameFeatures } from "./types";

const FEATURE_WEIGHTS: Record<FeatureKey, number> = {
  pitch: 1.35,
  yaw: 1.1,
  eyeVertical: 1.25,
  eyeHorizontal: 0.9,
  faceCenterX: 0.55,
  faceCenterY: 0.55,
  faceScale: 0.45
};

export function classifyAttention(
  features: FrameFeatures | null,
  profile: CalibrationProfile
): AttentionResult {
  if (!features?.faceDetected) {
    return {
      rawState: "face-missing",
      confidence: 1,
      distance: Number.POSITIVE_INFINITY
    };
  }

  const distance = weightedDistance(features, profile);
  if (distance <= 1) {
    return { rawState: "looking", confidence: clamp01(1 - distance / 1.4), distance };
  }

  if (distance <= 1.65) {
    return { rawState: "unknown", confidence: clamp01(1 - Math.abs(distance - 1.325) / 0.65), distance };
  }

  return { rawState: "away", confidence: clamp01((distance - 1.2) / 1.4), distance };
}

function weightedDistance(features: FrameFeatures, profile: CalibrationProfile) {
  let weightedSquares = 0;
  let totalWeight = 0;

  for (const key of FEATURE_KEYS) {
    const tolerance = Math.max(profile.tolerance[key], 0.0001);
    const normalizedDelta = Math.abs(features[key] - profile.center[key]) / tolerance;
    const weight = FEATURE_WEIGHTS[key];
    weightedSquares += normalizedDelta * normalizedDelta * weight;
    totalWeight += weight;
  }

  return Math.sqrt(weightedSquares / totalWeight);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
npm test -- src/domain/classifier.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/classifier.ts src/domain/classifier.test.ts
git commit -m "feat: add binary attention classifier"
```

## Task 4: Forgiving Smoothing State Machine

**Files:**
- Create: `src/domain/smoothing.ts`
- Create: `src/domain/smoothing.test.ts`

- [ ] **Step 1: Write the failing smoothing tests**

Create `src/domain/smoothing.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/domain/smoothing.test.ts
```

Expected: FAIL because `src/domain/smoothing.ts` does not exist.

- [ ] **Step 3: Implement smoothing**

Create `src/domain/smoothing.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
npm test -- src/domain/smoothing.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/smoothing.ts src/domain/smoothing.test.ts
git commit -m "feat: add forgiving attention smoothing"
```

## Task 5: Landmark Feature Extraction

**Files:**
- Create: `src/domain/landmarks.ts`
- Create: `src/domain/landmarks.test.ts`

- [ ] **Step 1: Write the failing landmark tests**

Create `src/domain/landmarks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractFrameFeatures, type NormalizedLandmark } from "./landmarks";

function landmarks(overrides: Partial<Record<number, NormalizedLandmark>> = {}) {
  const base = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const required: Partial<Record<number, NormalizedLandmark>> = {
    1: { x: 0.5, y: 0.42, z: -0.04 },
    33: { x: 0.34, y: 0.36, z: 0 },
    133: { x: 0.44, y: 0.36, z: 0 },
    145: { x: 0.39, y: 0.39, z: 0 },
    152: { x: 0.5, y: 0.7, z: 0 },
    159: { x: 0.39, y: 0.33, z: 0 },
    234: { x: 0.22, y: 0.5, z: 0 },
    263: { x: 0.66, y: 0.36, z: 0 },
    362: { x: 0.56, y: 0.36, z: 0 },
    374: { x: 0.61, y: 0.39, z: 0 },
    386: { x: 0.61, y: 0.33, z: 0 },
    454: { x: 0.78, y: 0.5, z: 0 },
    468: { x: 0.39, y: 0.36, z: 0 },
    473: { x: 0.61, y: 0.36, z: 0 },
    ...overrides
  };

  for (const [index, landmark] of Object.entries(required)) {
    base[Number(index)] = landmark;
  }
  return base;
}

describe("extractFrameFeatures", () => {
  it("returns normalized frame features from face landmarks", () => {
    const features = extractFrameFeatures(landmarks(), 1234);

    expect(features.faceDetected).toBe(true);
    expect(features.timestampMs).toBe(1234);
    expect(features.faceCenterX).toBeCloseTo(0.5, 2);
    expect(features.faceScale).toBeGreaterThan(0.3);
    expect(features.eyeVertical).toBeCloseTo(0.5, 1);
  });

  it("returns null when required landmarks are missing", () => {
    expect(extractFrameFeatures([], 1234)).toBeNull();
  });

  it("moves pitch and eyeVertical when the face looks down", () => {
    const neutral = extractFrameFeatures(landmarks(), 1000);
    const down = extractFrameFeatures(
      landmarks({
        1: { x: 0.5, y: 0.5, z: -0.04 },
        468: { x: 0.39, y: 0.385, z: 0 },
        473: { x: 0.61, y: 0.385, z: 0 }
      }),
      1016
    );

    expect(neutral).not.toBeNull();
    expect(down).not.toBeNull();
    expect(down!.pitch).toBeGreaterThan(neutral!.pitch);
    expect(down!.eyeVertical).toBeGreaterThan(neutral!.eyeVertical);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/domain/landmarks.test.ts
```

Expected: FAIL because `src/domain/landmarks.ts` does not exist.

- [ ] **Step 3: Implement landmark feature extraction**

Create `src/domain/landmarks.ts`:

```ts
import type { FrameFeatures } from "./types";

export type NormalizedLandmark = {
  x: number;
  y: number;
  z?: number;
};

const LANDMARK = {
  noseTip: 1,
  chin: 152,
  leftFace: 234,
  rightFace: 454,
  leftEyeOuter: 33,
  leftEyeInner: 133,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  rightEyeInner: 362,
  rightEyeOuter: 263,
  rightEyeTop: 386,
  rightEyeBottom: 374,
  leftIrisCenter: 468,
  rightIrisCenter: 473
} as const;

export function extractFrameFeatures(
  landmarks: NormalizedLandmark[],
  timestampMs: number
): FrameFeatures | null {
  if (!hasRequiredLandmarks(landmarks)) return null;

  const box = boundingBox(landmarks);
  const faceWidth = Math.max(box.maxX - box.minX, 0.0001);
  const faceHeight = Math.max(box.maxY - box.minY, 0.0001);
  const faceCenterX = box.minX + faceWidth / 2;
  const faceCenterY = box.minY + faceHeight / 2;

  const nose = landmarks[LANDMARK.noseTip];
  const chin = landmarks[LANDMARK.chin];
  const leftFace = landmarks[LANDMARK.leftFace];
  const rightFace = landmarks[LANDMARK.rightFace];
  const leftEyeOuter = landmarks[LANDMARK.leftEyeOuter];
  const rightEyeOuter = landmarks[LANDMARK.rightEyeOuter];
  const eyeCenterY = average([leftEyeOuter.y, rightEyeOuter.y]);

  const pitch = (nose.y - eyeCenterY) / Math.max(chin.y - eyeCenterY, 0.0001);
  const yaw = (nose.x - average([leftFace.x, rightFace.x])) / Math.max(rightFace.x - leftFace.x, 0.0001);
  const leftEye = eyeRatios(
    landmarks[LANDMARK.leftIrisCenter],
    landmarks[LANDMARK.leftEyeOuter],
    landmarks[LANDMARK.leftEyeInner],
    landmarks[LANDMARK.leftEyeTop],
    landmarks[LANDMARK.leftEyeBottom]
  );
  const rightEye = eyeRatios(
    landmarks[LANDMARK.rightIrisCenter],
    landmarks[LANDMARK.rightEyeInner],
    landmarks[LANDMARK.rightEyeOuter],
    landmarks[LANDMARK.rightEyeTop],
    landmarks[LANDMARK.rightEyeBottom]
  );

  return {
    timestampMs,
    faceDetected: true,
    pitch,
    yaw,
    eyeVertical: average([leftEye.vertical, rightEye.vertical]),
    eyeHorizontal: average([leftEye.horizontal, rightEye.horizontal]),
    faceCenterX,
    faceCenterY,
    faceScale: Math.max(faceWidth, faceHeight)
  };
}

function hasRequiredLandmarks(landmarks: NormalizedLandmark[]) {
  return Object.values(LANDMARK).every((index) => landmarks[index]);
}

function boundingBox(landmarks: NormalizedLandmark[]) {
  return landmarks.reduce(
    (box, landmark) => ({
      minX: Math.min(box.minX, landmark.x),
      minY: Math.min(box.minY, landmark.y),
      maxX: Math.max(box.maxX, landmark.x),
      maxY: Math.max(box.maxY, landmark.y)
    }),
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: 0, maxY: 0 }
  );
}

function eyeRatios(
  iris: NormalizedLandmark,
  outer: NormalizedLandmark,
  inner: NormalizedLandmark,
  top: NormalizedLandmark,
  bottom: NormalizedLandmark
) {
  return {
    vertical: clamp01((iris.y - top.y) / Math.max(bottom.y - top.y, 0.0001)),
    horizontal: clamp01((iris.x - outer.x) / Math.max(inner.x - outer.x, 0.0001))
  };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
npm test -- src/domain/landmarks.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/landmarks.ts src/domain/landmarks.test.ts
git commit -m "feat: extract attention features from landmarks"
```

## Task 6: Camera And MediaPipe Wrappers

**Files:**
- Create: `src/hooks/useCamera.ts`
- Create: `src/tracking/faceTracker.ts`
- Create: `src/hooks/useAttentionLoop.ts`

- [ ] **Step 1: Create the camera hook**

Create `src/hooks/useCamera.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unavailable" | "error";

export type CameraState = {
  status: CameraStatus;
  stream: MediaStream | null;
  errorMessage: string | null;
};

export function useCamera() {
  const [state, setState] = useState<CameraState>({
    status: "idle",
    stream: null,
    errorMessage: null
  });
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setState((current) => ({ ...current, stream: null, status: current.status === "ready" ? "idle" : current.status }));
  }, []);

  const request = useCallback(async () => {
    setState({ status: "requesting", stream: null, errorMessage: null });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 540 }
        },
        audio: false
      });
      streamRef.current = stream;
      setState({ status: "ready", stream, errorMessage: null });
    } catch (error) {
      const mapped = mapCameraError(error);
      setState({ status: mapped.status, stream: null, errorMessage: mapped.message });
    }
  }, []);

  useEffect(() => stop, [stop]);

  return { ...state, request, stop };
}

function mapCameraError(error: unknown): { status: CameraStatus; message: string } {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return { status: "denied", message: "Camera access is required for local attention tracking." };
  }

  if (error instanceof DOMException && (error.name === "NotFoundError" || error.name === "OverconstrainedError")) {
    return { status: "unavailable", message: "No usable webcam was found." };
  }

  return { status: "error", message: "The camera could not be started." };
}
```

- [ ] **Step 2: Create the MediaPipe tracker wrapper**

Create `src/tracking/faceTracker.ts`:

```ts
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { extractFrameFeatures } from "../domain/landmarks";
import type { FrameFeatures } from "../domain/types";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

export type FaceTrackerStatus = "idle" | "loading" | "ready" | "error";

export type FaceTracker = {
  detect(video: HTMLVideoElement, timestampMs: number): FrameFeatures | null;
  dispose(): void;
};

export async function createFaceTracker(): Promise<FaceTracker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numFaces: 1
  });

  return {
    detect(video: HTMLVideoElement, timestampMs: number) {
      const result = landmarker.detectForVideo(video, timestampMs);
      const landmarks = result.faceLandmarks[0];
      if (!landmarks) return null;
      return extractFrameFeatures(landmarks, timestampMs);
    },
    dispose() {
      landmarker.close();
    }
  };
}
```

- [ ] **Step 3: Create the tracking loop hook**

Create `src/hooks/useAttentionLoop.ts`:

```ts
import { useEffect, useRef } from "react";
import type { FrameFeatures } from "../domain/types";
import type { FaceTracker } from "../tracking/faceTracker";

export type AttentionLoopOptions = {
  active: boolean;
  tracker: FaceTracker | null;
  video: HTMLVideoElement | null;
  onFrame: (features: FrameFeatures | null, timestampMs: number) => void;
};

export function useAttentionLoop({ active, tracker, video, onFrame }: AttentionLoopOptions) {
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  useEffect(() => {
    if (!active || !tracker || !video) return;

    let frameId = 0;
    let cancelled = false;

    const tick = (timestampMs: number) => {
      if (cancelled) return;
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        onFrameRef.current(tracker.detect(video, timestampMs), timestampMs);
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [active, tracker, video]);
}
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCamera.ts src/hooks/useAttentionLoop.ts src/tracking/faceTracker.ts
git commit -m "feat: add camera and face tracker wrappers"
```

## Task 7: App Screens And Calibration Flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/components/CameraPreview.tsx`
- Create: `src/components/SetupScreen.tsx`
- Create: `src/components/CalibrationScreen.tsx`
- Create: `src/components/TestScreen.tsx`

- [ ] **Step 1: Create the camera preview component**

Create `src/components/CameraPreview.tsx`:

```tsx
import { useEffect, useRef } from "react";

type CameraPreviewProps = {
  stream: MediaStream | null;
  onVideoReady: (video: HTMLVideoElement | null) => void;
  visible?: boolean;
};

export function CameraPreview({ stream, onVideoReady, visible = false }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    onVideoReady(stream ? video : null);
  }, [onVideoReady, stream]);

  return (
    <video
      ref={videoRef}
      className={visible ? "camera-preview camera-preview-visible" : "camera-preview"}
      autoPlay
      playsInline
      muted
      aria-label="Local webcam preview"
    />
  );
}
```

- [ ] **Step 2: Create setup screen**

Create `src/components/SetupScreen.tsx`:

```tsx
import type { CameraStatus } from "../hooks/useCamera";
import type { FaceTrackerStatus } from "../tracking/faceTracker";

type SetupScreenProps = {
  cameraStatus: CameraStatus;
  trackerStatus: FaceTrackerStatus;
  errorMessage: string | null;
  hasFace: boolean;
  onRequestCamera: () => void;
  onStartCalibration: () => void;
};

export function SetupScreen({
  cameraStatus,
  trackerStatus,
  errorMessage,
  hasFace,
  onRequestCamera,
  onStartCalibration
}: SetupScreenProps) {
  const ready = cameraStatus === "ready" && trackerStatus === "ready" && hasFace;

  return (
    <main className="app-shell">
      <section className="setup-panel">
        <p className="eyebrow">Local webcam attention tracker</p>
        <h1>Calibrate before testing</h1>
        <p className="lede">
          Follow five dots so the app can learn your screen-looking posture, then run a green/red
          attention test.
        </p>
        <div className="status-grid" aria-label="Readiness">
          <Status label="Camera" value={cameraLabel(cameraStatus)} ready={cameraStatus === "ready"} />
          <Status label="Tracker" value={trackerLabel(trackerStatus)} ready={trackerStatus === "ready"} />
          <Status label="Face" value={hasFace ? "Detected" : "Waiting"} ready={hasFace} />
        </div>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {cameraStatus === "idle" || cameraStatus === "denied" || cameraStatus === "unavailable" || cameraStatus === "error" ? (
          <button className="primary-button" type="button" onClick={onRequestCamera}>
            Enable camera
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={onStartCalibration} disabled={!ready}>
            Start calibration
          </button>
        )}
      </section>
    </main>
  );
}

function Status({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div className="status-item">
      <span>{label}</span>
      <strong className={ready ? "status-ready" : ""}>{value}</strong>
    </div>
  );
}

function cameraLabel(status: CameraStatus) {
  const labels: Record<CameraStatus, string> = {
    idle: "Not started",
    requesting: "Requesting",
    ready: "Ready",
    denied: "Denied",
    unavailable: "Unavailable",
    error: "Error"
  };
  return labels[status];
}

function trackerLabel(status: FaceTrackerStatus) {
  const labels: Record<FaceTrackerStatus, string> = {
    idle: "Not loaded",
    loading: "Loading",
    ready: "Ready",
    error: "Error"
  };
  return labels[status];
}
```

- [ ] **Step 3: Create calibration screen**

Create `src/components/CalibrationScreen.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildCalibrationProfile,
  CALIBRATION_POINTS,
  MIN_VALID_SAMPLES_PER_POINT,
  type SamplesByPoint
} from "../domain/calibration";
import type { CalibrationPointId, CalibrationProfile, FrameFeatures } from "../domain/types";

type CalibrationScreenProps = {
  latestFeatures: FrameFeatures | null;
  onComplete: (profile: CalibrationProfile) => void;
  onCancel: () => void;
};

const POINT_DURATION_MS = 2000;

export function CalibrationScreen({ latestFeatures, onComplete, onCancel }: CalibrationScreenProps) {
  const [pointIndex, setPointIndex] = useState(0);
  const [pointStartedAt, setPointStartedAt] = useState(() => performance.now());
  const [nowMs, setNowMs] = useState(() => performance.now());
  const samplesRef = useRef<SamplesByPoint>({});
  const activePoint = CALIBRATION_POINTS[pointIndex];

  useEffect(() => {
    const frame = requestAnimationFrame(function tick(timestampMs) {
      setNowMs(timestampMs);
      requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!latestFeatures?.faceDetected) return;
    const samples = samplesRef.current[activePoint.id] ?? [];
    samplesRef.current[activePoint.id] = [...samples, { ...latestFeatures, point: activePoint.id }];
  }, [activePoint.id, latestFeatures]);

  useEffect(() => {
    const elapsed = nowMs - pointStartedAt;
    if (elapsed < POINT_DURATION_MS) return;

    const samples = samplesRef.current[activePoint.id] ?? [];
    if (samples.length < MIN_VALID_SAMPLES_PER_POINT) {
      samplesRef.current[activePoint.id] = [];
      setPointStartedAt(nowMs);
      return;
    }

    if (pointIndex < CALIBRATION_POINTS.length - 1) {
      setPointIndex((current) => current + 1);
      setPointStartedAt(nowMs);
      return;
    }

    const result = buildCalibrationProfile(samplesRef.current, Date.now());
    if (result.ok) {
      onComplete(result.profile);
    } else {
      const retryIndex = CALIBRATION_POINTS.findIndex((point) => point.id === result.pointId);
      samplesRef.current[result.pointId] = [];
      setPointIndex(Math.max(0, retryIndex));
      setPointStartedAt(nowMs);
    }
  }, [activePoint.id, nowMs, onComplete, pointIndex, pointStartedAt]);

  const countdown = useMemo(() => {
    const remaining = Math.max(0, POINT_DURATION_MS - (nowMs - pointStartedAt));
    return Math.ceil(remaining / 1000);
  }, [nowMs, pointStartedAt]);

  return (
    <main className="calibration-screen">
      <button className="secondary-button top-action" type="button" onClick={onCancel}>
        Cancel
      </button>
      <div
        className="calibration-dot"
        style={{ left: `${activePoint.xPercent}%`, top: `${activePoint.yPercent}%` }}
        aria-label={`Look at ${activePoint.label}`}
      />
      <div className="calibration-status">
        <p>{activePoint.label}</p>
        <strong>{countdown}</strong>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create test screen**

Create `src/components/TestScreen.tsx`:

```tsx
import type { AttentionResult } from "../domain/types";
import type { DisplayAttentionState, SmootherSnapshot } from "../domain/smoothing";

type TestScreenProps = {
  displayState: DisplayAttentionState;
  attention: AttentionResult | null;
  smoother: SmootherSnapshot | null;
  onRecalibrate: () => void;
};

export function TestScreen({ displayState, attention, smoother, onRecalibrate }: TestScreenProps) {
  const label = statusLabel(attention?.rawState ?? smoother?.rawState ?? "unknown");

  return (
    <main className={`test-screen test-screen-${displayState}`}>
      <button className="secondary-button top-action" type="button" onClick={onRecalibrate}>
        Recalibrate
      </button>
      <section className="test-status" aria-live="polite">
        <p>{label}</p>
        <span>
          {attention ? `Confidence ${Math.round(attention.confidence * 100)}%` : "Waiting for face"}
        </span>
      </section>
    </main>
  );
}

function statusLabel(rawState: string) {
  if (rawState === "looking") return "Looking at screen";
  if (rawState === "away") return "Looking away";
  if (rawState === "face-missing") return "Face not detected";
  return "Checking";
}
```

- [ ] **Step 5: Wire the app state machine**

Replace `src/App.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { CameraPreview } from "./components/CameraPreview";
import { CalibrationScreen } from "./components/CalibrationScreen";
import { SetupScreen } from "./components/SetupScreen";
import { TestScreen } from "./components/TestScreen";
import { classifyAttention } from "./domain/classifier";
import { createAttentionSmoother, type SmootherSnapshot } from "./domain/smoothing";
import type { AttentionResult, CalibrationProfile, FrameFeatures } from "./domain/types";
import { useAttentionLoop } from "./hooks/useAttentionLoop";
import { useCamera } from "./hooks/useCamera";
import { createFaceTracker, type FaceTracker, type FaceTrackerStatus } from "./tracking/faceTracker";

type AppMode = "setup" | "calibration" | "test";

export function App() {
  const camera = useCamera();
  const [mode, setMode] = useState<AppMode>("setup");
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [tracker, setTracker] = useState<FaceTracker | null>(null);
  const [trackerStatus, setTrackerStatus] = useState<FaceTrackerStatus>("idle");
  const [trackerError, setTrackerError] = useState<string | null>(null);
  const [latestFeatures, setLatestFeatures] = useState<FrameFeatures | null>(null);
  const [profile, setProfile] = useState<CalibrationProfile | null>(null);
  const [attention, setAttention] = useState<AttentionResult | null>(null);
  const [smootherSnapshot, setSmootherSnapshot] = useState<SmootherSnapshot | null>(null);
  const smoother = useMemo(() => createAttentionSmoother({ awayThresholdMs: 900, unknownGraceMs: 500 }), []);

  useEffect(() => {
    let disposed = false;
    setTrackerStatus("loading");
    createFaceTracker()
      .then((createdTracker) => {
        if (disposed) {
          createdTracker.dispose();
          return;
        }
        setTracker(createdTracker);
        setTrackerStatus("ready");
      })
      .catch(() => {
        if (!disposed) {
          setTrackerStatus("error");
          setTrackerError("The face tracking model could not be loaded.");
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => () => tracker?.dispose(), [tracker]);

  useAttentionLoop({
    active: camera.status === "ready" && trackerStatus === "ready",
    tracker,
    video,
    onFrame: useCallback(
      (features, timestampMs) => {
        setLatestFeatures(features);
        if (mode !== "test" || !profile) return;
        const nextAttention = classifyAttention(features, profile);
        setAttention(nextAttention);
        setSmootherSnapshot(smoother.update(nextAttention.rawState, timestampMs));
      },
      [mode, profile, smoother]
    )
  });

  const beginCalibration = () => {
    smoother.reset();
    setAttention(null);
    setSmootherSnapshot(null);
    setProfile(null);
    setMode("calibration");
  };

  const completeCalibration = (nextProfile: CalibrationProfile) => {
    setProfile(nextProfile);
    smoother.reset();
    setMode("test");
  };

  const displayState = smootherSnapshot?.displayState ?? "green";
  const errorMessage = camera.errorMessage ?? trackerError;

  return (
    <>
      <CameraPreview stream={camera.stream} onVideoReady={setVideo} />
      {mode === "setup" ? (
        <SetupScreen
          cameraStatus={camera.status}
          trackerStatus={trackerStatus}
          errorMessage={errorMessage}
          hasFace={Boolean(latestFeatures?.faceDetected)}
          onRequestCamera={camera.request}
          onStartCalibration={beginCalibration}
        />
      ) : null}
      {mode === "calibration" ? (
        <CalibrationScreen
          latestFeatures={latestFeatures}
          onComplete={completeCalibration}
          onCancel={() => setMode("setup")}
        />
      ) : null}
      {mode === "test" ? (
        <TestScreen
          displayState={displayState}
          attention={attention}
          smoother={smootherSnapshot}
          onRecalibrate={beginCalibration}
        />
      ) : null}
    </>
  );
}
```

- [ ] **Step 6: Replace CSS with the complete UI styles**

Replace `src/styles.css`:

```css
:root {
  color: #162017;
  background: #f5f7f2;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
}

.setup-panel {
  width: min(760px, 100%);
  display: grid;
  gap: 20px;
}

.eyebrow {
  margin: 0;
  color: #4f7257;
  font-size: 0.84rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 4.75rem;
  line-height: 0.96;
  letter-spacing: 0;
}

p {
  margin: 0;
}

.lede {
  max-width: 56ch;
  color: #405246;
  font-size: 1.1rem;
  line-height: 1.6;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.status-item {
  border: 1px solid #d8e0d6;
  border-radius: 8px;
  padding: 14px;
  display: grid;
  gap: 6px;
  background: #ffffff;
}

.status-item span {
  color: #607067;
  font-size: 0.86rem;
}

.status-item strong {
  color: #8a4d35;
}

.status-item .status-ready {
  color: #1d6f3a;
}

.primary-button,
.secondary-button {
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 800;
}

.primary-button {
  width: fit-content;
  min-height: 48px;
  padding: 0 22px;
  color: #ffffff;
  background: #225e3b;
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.secondary-button {
  min-height: 40px;
  padding: 0 16px;
  color: #172018;
  background: rgba(255, 255, 255, 0.82);
}

.error-text {
  color: #9b2c2c;
  font-weight: 700;
}

.camera-preview {
  position: fixed;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.camera-preview-visible {
  width: 180px;
  height: 120px;
  opacity: 1;
}

.top-action {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 3;
}

.calibration-screen {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: #f8faf6;
}

.calibration-dot {
  position: absolute;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: #145cff;
  box-shadow: 0 0 0 14px rgba(20, 92, 255, 0.14);
}

.calibration-status {
  position: fixed;
  left: 50%;
  bottom: 38px;
  transform: translateX(-50%);
  display: grid;
  gap: 6px;
  justify-items: center;
  color: #18221a;
}

.calibration-status strong {
  font-size: 2.6rem;
}

.test-screen {
  min-height: 100vh;
  display: grid;
  place-items: center;
  transition: background 160ms ease, color 160ms ease;
}

.test-screen-green {
  color: #083716;
  background: #43d16f;
}

.test-screen-red {
  color: #ffffff;
  background: #d93030;
}

.test-status {
  display: grid;
  justify-items: center;
  gap: 10px;
  text-align: center;
}

.test-status p {
  font-size: 5.5rem;
  font-weight: 900;
  line-height: 1;
}

.test-status span {
  font-weight: 800;
  opacity: 0.78;
}

@media (max-width: 680px) {
  .app-shell {
    padding: 22px;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }

  h1 {
    font-size: 2.75rem;
  }

  .test-status p {
    font-size: 2.5rem;
  }
}
```

- [ ] **Step 7: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/styles.css src/components
git commit -m "feat: add calibration and test screens"
```

## Task 8: Verification And Browser Gut Check

**Files:**
- Modify files only if verification reveals issues in files created by earlier tasks.

- [ ] **Step 1: Run all automated tests**

Run:

```bash
npm test
```

Expected: all test files pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 3: Start the dev server**

Run:

```bash
npm run dev
```

Expected: Vite serves the app on `http://127.0.0.1:5173` or the next available port.

- [ ] **Step 4: Verify manually in the browser**

Open the local URL and verify:

- The setup screen loads without runtime errors.
- Enabling the camera triggers the browser permission prompt.
- The model status becomes ready after MediaPipe assets load.
- The start calibration button enables only after camera, tracker, and face detection are ready.
- Calibration shows dots in this order: top-left, top-right, bottom-right, bottom-left, center.
- Each dot advances automatically after about two seconds when the face is visible.
- The test screen is green while looking at the screen.
- Looking down or away for about one second turns the screen red.
- Looking back at the screen turns the screen green.
- Recalibrate returns to the five-dot calibration flow.

- [ ] **Step 5: Commit verification fixes**

If files changed during verification, run:

```bash
git add src package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts
git commit -m "fix: polish webcam attention verification"
```

Expected: either a fix commit is created, or `git status --short` shows no uncommitted app changes.

## Self-Review

Spec coverage:

- Local-only browser app: Task 1, Task 6, Task 7.
- Five-dot automatic calibration: Task 2 and Task 7.
- MediaPipe Face Landmarker: Task 6.
- Calibration-based binary classifier: Task 2 and Task 3.
- 0.75-1.0 second forgiving smoothing: Task 4.
- Full-screen green/red test: Task 7.
- Camera and model errors: Task 6 and Task 7.
- Automated logic tests: Tasks 2, 3, 4, and 5.
- Manual browser verification: Task 8.

Placeholder scan: no placeholder markers or incomplete steps are present.

Type consistency: `FrameFeatures`, `CalibrationProfile`, `RawAttentionState`, `AttentionResult`, and `DisplayAttentionState` are defined before use and referenced consistently across tasks.
