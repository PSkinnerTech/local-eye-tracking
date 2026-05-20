# Developer README Design

## Goal

Create a contributor-focused `README.md` for the local webcam attention tracker. The README should help a developer quickly understand what the project does, how to run it, how the tracking pipeline works, how to evaluate accuracy, and where future contributions should focus.

## Audience

The primary audience is developers and technical contributors. The README should still be readable to a technically curious teacher, parent, or user, but it should lead with implementation clarity rather than marketing copy.

## Positioning

The project should be described as an experimental, local-only browser prototype for binary attention feedback during typing practice. It should not claim precise gaze tracking or production-grade biometric reliability.

The opening summary should communicate:

- It runs in the browser.
- It uses a laptop webcam and MediaPipe Face Landmarker.
- It is designed to detect screen attention versus down/away attention.
- It is local-only and does not upload webcam frames.
- It includes calibration, smoothing, diagnostics, and an evaluation harness.

## README Structure

### 1. Title

Use the public repository name as the main heading:

```markdown
# Local Eye Tracking
```

Follow with a concise subtitle:

```markdown
Local-only webcam attention tracking for typing practice.
```

### 2. Summary

Explain the project in one short paragraph. The summary should say this app helps test whether a typing student appears to be looking at the screen or looking down/away, using local webcam-based feature extraction and a calibrated binary classifier.

### 3. Current Status

Add a short status note:

- Experimental prototype.
- Intended for local testing and tuning.
- Not a medical, accessibility, proctoring, or production biometric system.
- Accuracy depends on webcam placement, lighting, face framing, and calibration quality.

### 4. What It Does

Use bullets to list the current capabilities:

- Requests webcam access in the browser.
- Loads local MediaPipe Face Landmarker model and WASM assets.
- Guides a six-step calibration: five screen points plus a keyboard-looking sample.
- Rejects weak keyboard calibration and asks for retry.
- Runs a full-screen green/red attention test.
- Uses keyboard-looking and side-gaze diagnostics.
- Smooths raw classifier output to reduce flicker.
- Provides a local evaluation panel for labeled samples.
- Exports local JSON evaluation files.
- Includes a CLI analyzer for evaluation exports.

### 5. Privacy Model

Make privacy prominent. The README should state:

- Webcam processing happens locally in the browser.
- Model and WASM assets are served from the repository's `public/` directory.
- No video frames, images, or webcam recordings are uploaded by the app.
- Calibration data is held in memory for the browser session.
- Evaluation exports are user-triggered JSON files containing numeric feature samples and classifier output, not video.

### 6. Architecture

Describe the main stack and modules:

- React, TypeScript, and Vite.
- MediaPipe Face Landmarker via `@mediapipe/tasks-vision`.
- `src/hooks/useCamera.ts` for webcam permission and stream state.
- `src/hooks/useAttentionLoop.ts` for the frame loop.
- `src/tracking/faceTracker.ts` for MediaPipe model setup and detection.
- `src/domain/landmarks.ts` for converting landmarks and model outputs into features.
- `src/domain/calibration.ts` for calibration profile creation and keyboard separation quality.
- `src/domain/classifier.ts` for raw attention classification.
- `src/domain/smoothing.ts` and `src/domain/statePipeline.ts` for green/red display smoothing.
- `src/domain/evaluation.ts` and `scripts/analyze-evaluation.mjs` for local evaluation.

Include a compact pipeline diagram in text:

```text
webcam frame
  -> MediaPipe Face Landmarker
  -> feature extraction
  -> calibration-aware classifier
  -> smoothing
  -> green/red UI
```

### 7. How Tracking Works

Explain the tracking strategy at a developer level without overclaiming.

The README should cover:

- The app extracts head, eye, face-position, and face-scale features from webcam frames.
- Calibration builds a screen-looking profile from the five screen points.
- Calibration also builds a keyboard-looking profile from the keyboard step.
- Keyboard separation is used as a quality gate.
- Side-gaze score catches strong left/right attention shifts that can otherwise be diluted in the pooled distance metric.
- The classifier emits `looking`, `unknown`, `away`, or `face-missing`.
- The smoother turns those raw states into the user-visible green/red display.

### 8. Getting Started

Document local setup:

```bash
npm install
npm run dev
```

Then tell the developer to open:

```text
http://127.0.0.1:5173/
```

Mention that camera access usually requires `localhost` or `127.0.0.1` in a modern browser.

### 9. Using The App

Document the current manual flow:

1. Open the local URL.
2. Allow camera access.
3. Wait for camera, tracker, and face readiness.
4. Start calibration.
5. Look at each screen dot during the countdown.
6. Look down at the keyboard during the keyboard calibration step.
7. Retry keyboard calibration if the app reports weak separation.
8. Use the full-screen test: green means looking at screen, red means looking away/down or face missing after smoothing.
9. Recalibrate when lighting, posture, camera placement, or the user changes.

### 10. Evaluation Workflow

Explain the in-app evaluation panel:

- It is available during test mode.
- It captures labeled feature/classifier samples.
- It targets 20 samples per label for 160 total balanced samples.
- Labels are `screen-center`, `screen-bottom`, `keyboard`, `off-left`, `off-right`, `lean-left`, `lean-right`, and `low-light`.
- It exports JSON files named like `eyes-baseline-eval-...json`.

Document the analyzer command:

```bash
npm run analyze:evaluation -- /path/to/eyes-baseline-eval.json
```

Explain the key metrics:

- `False-looking rate`: away-role samples classified as looking. This is the critical metric for keyboard and offscreen detection.
- `False-away rate`: screen-role samples classified as away. This captures over-aggressive red states.
- `Median keyboard`: keyboard projection score by label.
- `Median side`: side-gaze score by label.
- `Face missing`: camera framing or landmark tracking loss.

### 11. Development Commands

List the commands:

```bash
npm run dev
npm test
npm run build
npm run analyze:evaluation -- <export.json>
```

Mention that tests cover domain logic, hooks, components, calibration, classifier behavior, smoothing, evaluation summaries, and the analyzer.

### 12. Repository Layout

Include a compact file tree:

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

### 13. Limitations

Be honest about known constraints:

- Webcam gaze detection is approximate.
- This is binary attention feedback, not exact gaze-coordinate prediction.
- Lighting, camera angle, face position, glasses, and posture can affect results.
- Keyboard calibration quality is critical.
- Leaning out of frame causes face-missing states.
- The app does not save profiles between sessions.
- The app has no accounts, teacher dashboard, storage backend, or typing lesson integration.

### 14. Roadmap

Keep the roadmap short and grounded:

- Improve calibration quality feedback.
- Improve lean and face-framing handling.
- Add richer evaluation reports.
- Compare future model-based gaze estimators only if the current MediaPipe pipeline cannot meet the binary metric.
- Consider a student typing-session summary after classifier accuracy is stable.

### 15. License

Reference the MIT license:

```markdown
MIT License. Copyright (c) 2026 PSkinnerTech.
```

## Tone

The README should be direct, technical, and honest. It should avoid hype, avoid implying production readiness, and avoid claiming exact eye tracking. It should make the project easy to run, easy to inspect, and easy to tune.

## Success Criteria

The README is successful when a new contributor can answer these questions without reading the full codebase:

- What is this project for?
- How do I run it?
- How do I calibrate and use it?
- What data stays local?
- How does the classifier roughly work?
- How do I collect and analyze evaluation samples?
- What are the current limitations?
- Where should future accuracy work focus?
