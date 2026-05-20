# Developer README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a contributor-focused `README.md` that explains what Local Eye Tracking is, how to run it, how the webcam attention pipeline works, how to use the evaluation harness, and where future contributors should focus.

**Architecture:** This is a documentation-only change. The README will live at the repository root and summarize the existing React/Vite/MediaPipe app, local privacy model, calibration flow, classifier pipeline, evaluation tooling, limitations, and roadmap. No runtime code or package scripts should change.

**Tech Stack:** Markdown, React, TypeScript, Vite, MediaPipe Face Landmarker, Vitest, local Node CLI analyzer.

---

## File Structure

- Create: `/Users/SuperBuilder/dev/eyes/README.md`
  - Root project documentation for developers and contributors.
- Reference only: `/Users/SuperBuilder/dev/eyes/package.json`
  - Verify commands and license metadata.
- Reference only: `/Users/SuperBuilder/dev/eyes/LICENSE`
  - Verify copyright and license wording.
- Reference only: `/Users/SuperBuilder/dev/eyes/docs/superpowers/specs/2026-05-20-readme-design.md`
  - Source design for README content and tone.

---

### Task 1: Create Contributor-Focused README

**Files:**
- Create: `/Users/SuperBuilder/dev/eyes/README.md`
- Reference: `/Users/SuperBuilder/dev/eyes/docs/superpowers/specs/2026-05-20-readme-design.md`
- Reference: `/Users/SuperBuilder/dev/eyes/package.json`
- Reference: `/Users/SuperBuilder/dev/eyes/LICENSE`

- [ ] **Step 1: Confirm README is absent**

Run:

```bash
test ! -f README.md
```

Expected: command exits `0`, confirming this task creates the first root README.

- [ ] **Step 2: Create README.md**

Create `/Users/SuperBuilder/dev/eyes/README.md` with this exact content:

```markdown
# Local Eye Tracking

Local-only webcam attention tracking for typing practice.

Local Eye Tracking is an experimental browser app that uses a laptop webcam to estimate whether a typing student appears to be looking at the screen or looking down/away. It uses local MediaPipe Face Landmarker features, a calibration-aware binary classifier, smoothing, diagnostics, and a local evaluation workflow.

The goal is not exact gaze-coordinate prediction. The goal is lightweight binary feedback: green when the user appears to be looking at the screen, red when the user appears to be looking away, looking down at the keyboard, or missing from the webcam frame long enough to matter.

## Current Status

This project is an experimental prototype for local testing and tuning. It is not a medical device, accessibility system, proctoring product, or production-grade biometric system.

Accuracy depends on webcam placement, lighting, face framing, posture, glasses, and calibration quality. Treat results as a signal to tune and evaluate, not as ground truth.

## What It Does

- Requests webcam access in the browser.
- Loads local MediaPipe Face Landmarker model and WASM assets.
- Guides a six-step calibration: five screen points plus a keyboard-looking sample.
- Rejects weak keyboard calibration and asks for a retry.
- Runs a full-screen green/red attention test.
- Uses keyboard-looking and side-gaze diagnostics.
- Smooths raw classifier output to reduce flicker.
- Provides a local evaluation panel for labeled samples.
- Exports local JSON evaluation files.
- Includes a CLI analyzer for evaluation exports.

## Privacy Model

The app is designed to run locally.

- Webcam processing happens in the browser.
- MediaPipe model and WASM assets are served from this repository's `public/` directory.
- The app does not upload video frames, images, or webcam recordings.
- Calibration data is held in memory for the current browser session.
- Evaluation exports are user-triggered JSON files containing numeric feature samples and classifier output, not video.

## Architecture

The app is built with React, TypeScript, and Vite. Webcam tracking uses `@mediapipe/tasks-vision` with local model and WASM assets.

```text
webcam frame
  -> MediaPipe Face Landmarker
  -> feature extraction
  -> calibration-aware classifier
  -> smoothing
  -> green/red UI
```

Important modules:

- `src/hooks/useCamera.ts`: webcam permission and stream state.
- `src/hooks/useAttentionLoop.ts`: browser frame loop for tracking.
- `src/tracking/faceTracker.ts`: MediaPipe Face Landmarker setup and detection wrapper.
- `src/domain/landmarks.ts`: converts landmarks and model outputs into frame features.
- `src/domain/calibration.ts`: creates calibration profiles and keyboard separation quality.
- `src/domain/classifier.ts`: classifies each frame as `looking`, `unknown`, `away`, or `face-missing`.
- `src/domain/smoothing.ts`: turns raw classifier states into stable green/red display state.
- `src/domain/statePipeline.ts`: connects classifier output to smoothing.
- `src/domain/evaluation.ts`: local labeled evaluation sample model and summaries.
- `scripts/analyze-evaluation.mjs`: CLI analyzer for exported evaluation JSON.

## How Tracking Works

The tracker extracts a compact feature vector from each valid webcam frame. Features include head-pose estimates, aggregate eye movement, per-eye horizontal and vertical signals, eye openness, face center, and face scale.

Calibration builds a screen-looking profile from five guided screen points:

1. Top left
2. Top right
3. Bottom right
4. Bottom left
5. Center

Calibration then captures a keyboard-looking sample. The app computes keyboard separation quality from the screen profile and keyboard profile. If that separation is weak, the app retries the keyboard calibration step instead of entering test mode.

During testing, the classifier combines:

- Screen-profile distance.
- Keyboard projection score.
- Keyboard calibration quality.
- Side-gaze score.
- Face presence.

It emits one raw state per frame:

- `looking`
- `unknown`
- `away`
- `face-missing`

The smoother then applies forgiving timing so brief blinks, transient uncertainty, and short interruptions do not immediately flip the UI red.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local dev server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

Camera access generally requires `localhost` or `127.0.0.1` in a modern browser.

## Using The App

1. Open `http://127.0.0.1:5173/`.
2. Allow camera access.
3. Wait for camera, tracker, and face readiness.
4. Click **Start calibration**.
5. Look at each screen dot during the countdown.
6. Look down at the keyboard during the keyboard calibration step.
7. If keyboard calibration is weak, retry while looking down and keeping your face visible.
8. Use the full-screen test.
9. Recalibrate when lighting, posture, camera placement, or the user changes.

In test mode:

- Green means the user appears to be looking at the screen.
- Red means the user appears to be looking away, looking down, or missing from the webcam frame after smoothing.

## Evaluation Workflow

The app includes a local evaluation panel during test mode. It captures labeled feature/classifier samples for tuning. It does not capture video frames.

The balanced baseline target is 20 samples per label:

- `screen-center`
- `screen-bottom`
- `keyboard`
- `off-left`
- `off-right`
- `lean-left`
- `lean-right`
- `low-light`

That produces a balanced `160/160` sample export.

After exporting JSON from the evaluation panel, analyze it with:

```bash
npm run analyze:evaluation -- /path/to/eyes-baseline-eval.json
```

Key analyzer fields:

- `False-looking rate`: away-role samples classified as looking. This is the critical metric for keyboard and offscreen detection.
- `False-away rate`: screen-role samples classified as away. This catches over-aggressive red states.
- `Median keyboard`: keyboard projection score by label.
- `Median side`: side-gaze score by label.
- `Face missing`: webcam framing or landmark tracking loss.

## Development Commands

```bash
npm run dev
npm test
npm run build
npm run analyze:evaluation -- <export.json>
```

The test suite covers domain logic, hooks, components, calibration behavior, classifier behavior, smoothing, evaluation summaries, and the evaluation analyzer.

## Repository Layout

```text
src/components/        React UI screens and panels
src/domain/            Calibration, features, classifier, smoothing, evaluation logic
src/hooks/             Camera and frame-loop hooks
src/tracking/          MediaPipe Face Landmarker wrapper
scripts/               Evaluation export analyzer
public/models/         Local MediaPipe model asset
public/wasm/           Local MediaPipe WASM runtime assets
docs/superpowers/      Design specs and implementation plans
```

## Limitations

- Webcam gaze detection is approximate.
- This is binary attention feedback, not exact gaze-coordinate prediction.
- Lighting, camera angle, face position, glasses, and posture can affect results.
- Keyboard calibration quality is critical.
- Leaning out of frame causes `face-missing` states.
- Calibration profiles are not saved between sessions.
- The app has no accounts, teacher dashboard, storage backend, or typing lesson integration.

## Roadmap

- Improve calibration quality feedback.
- Improve lean and face-framing handling.
- Add richer evaluation reports.
- Compare future model-based gaze estimators only if the current MediaPipe pipeline cannot meet the binary attention metric.
- Consider a student typing-session summary after classifier accuracy is stable.

## License

MIT License. Copyright (c) 2026 PSkinnerTech.
```

- [ ] **Step 3: Inspect README content**

Run:

```bash
sed -n '1,260p' README.md
```

Expected: output shows every section from `# Local Eye Tracking` through `## License`, with no placeholder text.

- [ ] **Step 4: Commit README**

Run:

```bash
git add README.md
git commit -m "docs: add contributor readme"
```

Expected: commit succeeds and includes only `README.md`.

---

### Task 2: Verify README Accuracy And Repo Health

**Files:**
- Verify: `/Users/SuperBuilder/dev/eyes/README.md`
- Reference: `/Users/SuperBuilder/dev/eyes/package.json`
- Reference: `/Users/SuperBuilder/dev/eyes/LICENSE`
- Reference: `/Users/SuperBuilder/dev/eyes/public/models/face_landmarker.task`
- Reference: `/Users/SuperBuilder/dev/eyes/public/wasm/`

- [ ] **Step 1: Verify commands documented in README exist**

Run:

```bash
npm run
```

Expected: output includes `dev`, `test`, `build`, `preview`, and `analyze:evaluation`.

- [ ] **Step 2: Verify key local assets exist**

Run:

```bash
test -f public/models/face_landmarker.task
test -f public/wasm/vision_wasm_internal.wasm
test -f public/wasm/vision_wasm_internal.js
```

Expected: all commands exit `0`.

- [ ] **Step 3: Verify README mentions the required contributor topics**

Run:

```bash
rg -n "Privacy Model|Architecture|How Tracking Works|Evaluation Workflow|Development Commands|Limitations|Roadmap|MIT License" README.md
```

Expected: output includes one matching heading or line for each required README topic.

- [ ] **Step 4: Verify whitespace and markdown-adjacent hygiene**

Run:

```bash
git diff --check HEAD~1..HEAD
```

Expected: no output.

- [ ] **Step 5: Run automated tests**

Run:

```bash
npm test
```

Expected: all test files pass.

- [ ] **Step 6: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 7: Commit verification note only if README changes are needed**

If verification reveals wording or accuracy issues, edit `README.md`, then run:

```bash
git add README.md
git commit -m "docs: refine contributor readme"
```

Expected: commit succeeds only if the README was changed after the first commit. If no changes were needed, skip this step.

---

## Self-Review Checklist

- [ ] The plan creates exactly one product documentation file: `README.md`.
- [ ] The README content matches the approved design spec.
- [ ] The README is contributor-first and avoids marketing-heavy language.
- [ ] The README does not claim exact gaze tracking.
- [ ] The privacy section states that video frames are not uploaded.
- [ ] The evaluation workflow includes the analyzer command and key metrics.
- [ ] The limitations section is explicit about webcam accuracy and calibration constraints.
- [ ] Verification commands prove package scripts, local assets, tests, build, and whitespace hygiene.
