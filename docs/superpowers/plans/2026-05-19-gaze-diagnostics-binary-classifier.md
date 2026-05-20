# Gaze Diagnostics Binary Classifier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add evidence-oriented diagnostics and a calibrated binary classifier for screen-vs-keyboard attention.

**Architecture:** Extend the existing MediaPipe landmark feature vector, build calibration diagnostics from screen and keyboard samples, then classify live frames with a screen-to-keyboard projection before falling back to the existing distance threshold. Keep all data local and in memory.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, MediaPipe Face Landmarker.

---

### Task 1: Rich Landmark Feature Extraction

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/landmarks.ts`
- Test: `src/domain/landmarks.test.ts`

- [ ] **Step 1: Write failing tests**

Add assertions that `extractFrameFeatures()` returns separate left/right iris ratios and eye openness, and that an eye-only downward glance changes per-eye vertical features while head pitch stays unchanged.

- [ ] **Step 2: Verify red**

Run: `npm test -- src/domain/landmarks.test.ts`

Expected: FAIL because the new feature keys do not exist yet.

- [ ] **Step 3: Implement features**

Add these `FeatureKey` values:

```ts
"leftEyeVertical" | "rightEyeVertical" | "leftEyeHorizontal" | "rightEyeHorizontal" | "leftEyeOpenness" | "rightEyeOpenness"
```

Compute them from existing eye landmarks and include them in `FrameFeatures`. Keep existing aggregate features.

- [ ] **Step 4: Verify green**

Run: `npm test -- src/domain/landmarks.test.ts`

Expected: PASS.

### Task 2: Calibration Quality Diagnostics

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/calibration.ts`
- Test: `src/domain/calibration.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that keyboard calibration produces:

```ts
keyboardSeparation: number
keyboardQuality: "weak" | "usable" | "strong"
```

Also add a weak-separation test where keyboard and screen samples are nearly identical.

- [ ] **Step 2: Verify red**

Run: `npm test -- src/domain/calibration.test.ts`

Expected: FAIL because calibration diagnostics do not exist.

- [ ] **Step 3: Implement diagnostics**

Compute weighted distance between `profile.center` and `profile.keyboardCenter` using pooled tolerances. Set:

```ts
weak: separation < 0.75
usable: separation >= 0.75 && separation < 1.35
strong: separation >= 1.35
```

- [ ] **Step 4: Verify green**

Run: `npm test -- src/domain/calibration.test.ts`

Expected: PASS.

### Task 3: Binary Screen-Vs-Keyboard Classifier

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/classifier.ts`
- Test: `src/domain/classifier.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that:

- An eye-only keyboard glance classifies as away when it projects toward the keyboard calibration.
- A bottom-screen-like frame remains looking when its projection is below the keyboard threshold.
- Attention results include diagnostic fields.
- Weak keyboard separation falls back to normal screen distance behavior.

- [ ] **Step 2: Verify red**

Run: `npm test -- src/domain/classifier.test.ts`

Expected: FAIL because projection diagnostics and binary logic do not exist.

- [ ] **Step 3: Implement classifier**

Add projection score:

```ts
score = dot(normalizedFrameFromScreenCenter, normalizedKeyboardAxis) / dot(normalizedKeyboardAxis, normalizedKeyboardAxis)
```

Classify as away when keyboard separation is usable and either:

```ts
score >= 0.55 && keyboardDistance < screenDistance + 0.25
```

or:

```ts
score >= 0.75
```

Clamp diagnostic score into a readable range for display.

- [ ] **Step 4: Verify green**

Run: `npm test -- src/domain/classifier.test.ts`

Expected: PASS.

### Task 4: Test Screen Diagnostics UI

**Files:**
- Modify: `src/components/TestScreen.tsx`
- Modify: `src/styles.css`
- Test: `src/App.test.tsx` or `src/components/TestScreen.test.tsx`

- [ ] **Step 1: Write failing UI test**

Render `TestScreen` with an `AttentionResult` containing diagnostics and assert that calibration quality, keyboard score, and screen distance are visible.

- [ ] **Step 2: Verify red**

Run: `npm test -- src/components/TestScreen.test.tsx`

Expected: FAIL if the test file is new or diagnostics are not rendered.

- [ ] **Step 3: Implement UI**

Add a compact diagnostics panel in test mode. Show values only when finite. Keep the recalibrate control.

- [ ] **Step 4: Verify green**

Run: `npm test -- src/components/TestScreen.test.tsx`

Expected: PASS.

### Task 5: Full Verification

**Files:**
- No source edits unless verification reveals a bug.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Browser smoke test**

Open `http://127.0.0.1:5173/`, confirm the app loads, the setup screen renders, and no new runtime error appears before camera interaction.
