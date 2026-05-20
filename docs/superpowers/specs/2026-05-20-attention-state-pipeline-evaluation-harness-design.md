# Attention State Pipeline And Evaluation Harness Design

## Goal

Make the webcam attention tracker easier to tune and more reliable for the target classroom use case: detecting when a typing student looks down at their hands or keyboard while avoiding distracting flicker when the signal is uncertain.

This spec covers the next focused step before heavier gaze-model work:

1. Preserve the classifier's raw state semantics instead of collapsing every frame through a tracking-score threshold.
2. Add a local-only evaluation harness for labeled feature samples so tuning decisions are based on repeatable evidence.

## Context

The app already runs entirely in the browser with local MediaPipe Face Landmarker assets. Calibration now includes the five screen points plus a keyboard-looking point, and the classifier returns richer diagnostics such as screen distance, keyboard distance, keyboard score, keyboard separation, and calibration quality.

The remaining problem is that the app still sends classifier output through `rawStateForTrackingThreshold()` before smoothing. That turns the classifier's richer `looking`, `unknown`, `away`, and `face-missing` states into a score-only binary decision. As a result, the UI can show confusing combinations such as "Looking away" while the screen is still green, and the product team ends up tuning a single threshold by hand instead of evaluating classifier behavior from labeled samples.

## Users And Product Constraints

The primary user is a student learning to type. The app should give binary, lightweight feedback:

- Green means the student appears to be looking at the screen.
- Red means the student appears to be looking away, including down at hands or keyboard.

The app must remain:

- Browser-based.
- Local-only.
- Lightweight enough for a laptop webcam.
- Forgiving enough to avoid punishing blinks, brief uncertainty, and small posture shifts.
- Simple enough that a teacher or parent can recalibrate without understanding gaze-model internals.

## Recommendation Review

The research recommendations are good for this build, but the sequence should be adjusted.

### Accepted Now

State pipeline cleanup should happen first. The classifier already knows about `unknown` and keyboard-looking. The smoother should receive the classifier's raw state directly so the existing unknown grace window can do its job.

An evaluation harness should happen next. Before adding more model outputs, the app needs a repeatable way to collect local labeled feature samples and summarize false-looking, false-away, and transition behavior.

### Accepted After Measurement

MediaPipe blendshapes and facial transformation matrices are a strong follow-up. They stay within the current dependency and can improve head-pose and eye-signal quality. They should be added after the harness exists so the improvement can be measured.

Removing `faceCenterX`, `faceCenterY`, and `faceScale` from the gaze-distance metric is also a strong follow-up. Those values should remain useful as posture and quality diagnostics, but they should not dominate gaze distance.

Per-point screen clusters should follow the same measured path. The current screen samples are pooled into one centroid, which loses screen geometry. Per-point screen clusters are likely better, but the evaluation harness should prove how much they help.

### Deferred

Human, WebEyeTrack, L2CS-Net, and OpenFace should not be added yet. They may become useful if the improved MediaPipe architecture still cannot separate keyboard-looking from screen-looking well enough. For now they add migration cost before the current architecture has been measured cleanly.

## Architecture

The implementation should introduce a narrow state pipeline and evaluation layer without changing the camera or calibration UX.

### Attention State Pipeline

The per-frame pipeline should become:

```text
MediaPipe features
  -> classifyAttention(features, profile)
  -> rawState from classifier
  -> createAttentionSmoother().update(rawState, timestampMs)
  -> green/red display state
```

Tracking score remains visible in diagnostics, but it should not override `unknown` or `away` globally. If a score-based fallback is still needed, it should live inside `classifyAttention()` where it can respect keyboard diagnostics and return an explicit raw state.

### Evaluation Harness

Add an in-app developer/testing panel that can be reached without a server backend. It should collect only feature vectors and classifier results, not video frames or images.

The harness should support labeled sample sets:

- `screen-center`
- `screen-bottom`
- `keyboard`
- `off-left`
- `off-right`
- `lean-left`
- `lean-right`
- `low-light`

Each sample should store:

- Timestamp.
- Label.
- Current feature vector when a face is detected.
- Classifier raw state.
- Display state from the current live smoother snapshot.
- Tracking score.
- Screen distance.
- Keyboard score and distance when available.
- Keyboard calibration quality when available.

The harness should compute summary metrics in memory:

- Sample count per label.
- Percent classified looking, unknown, away, and face-missing per label.
- False-looking rate for keyboard/offscreen labels.
- False-away rate for screen labels.
- Median tracking score by label.
- Median keyboard score by label.

The harness should allow export as a JSON file for manual inspection. Exported data remains user-controlled and local.

## UI Design

The normal user flow should stay quiet:

- Setup screen.
- Calibration.
- Full-screen green/red test.

The evaluation harness should be intentionally secondary. It can be a small diagnostics control available during test mode, such as "Evaluate" near the existing recalibrate control. Opening it should reveal label buttons and a capture counter. This avoids turning the student-facing experience into a technical dashboard.

The current compact diagnostics panel can remain during development. The harness should not require the main green/red area to be redesigned.

## Data And Privacy

No camera frames, screenshots, face images, or video clips should be stored by this feature.

Feature samples are numeric face/eye measurements and classifier outputs. They should live in memory until the user clears them, recalibrates, refreshes the page, or explicitly exports JSON.

No network calls should be added.

## Error Handling

If no calibration profile exists, the evaluation harness should be disabled and explain that calibration is required.

If the face is missing, the harness may still record a sample with `rawState: "face-missing"` and no feature vector, so face-loss behavior can be measured.

If a label has too few samples, summaries should show the sample count but avoid presenting strong conclusions. A practical minimum is 20 samples per label for manual tuning.

If export fails, the app should keep the samples in memory and show a short error message.

## Testing

Automated tests should cover:

- `App` or a small state-pipeline helper uses classifier `rawState` directly instead of `rawStateForTrackingThreshold()`.
- The smoother still holds `unknown` briefly before red.
- Evaluation samples can be added with labels and attention diagnostics.
- Summary metrics count states correctly by label.
- False-looking and false-away rates are computed from labeled samples.
- JSON export shape contains labels, features, attention diagnostics, and summary metadata.
- UI renders label controls and sample counts without disrupting the test screen.

Manual verification should cover:

- Calibrate once.
- Record screen-center samples.
- Record keyboard samples.
- Confirm screen labels mostly summarize as looking.
- Confirm keyboard labels reveal whether false-looking remains high.
- Confirm the full-screen display still flips red only after smoothing.

## Success Criteria

This phase succeeds when:

- The app no longer globally collapses classifier output through `rawStateForTrackingThreshold()` before smoothing.
- `unknown` remains a distinct state through the smoother.
- A tester can collect local labeled feature samples for the key typing-use labels.
- The app reports false-looking and false-away rates from those samples.
- The team can decide the next tuning step from measured evidence instead of one-off threshold guesses.

## Out Of Scope

- Adding Human, WebEyeTrack, L2CS-Net, OpenFace, TensorFlow.js, or a Python process.
- Training a model.
- Uploading data.
- Teacher dashboards or student records.
- Saving calibration profiles across browser sessions.
- Building exact gaze-cursor prediction.
- Replacing MediaPipe Face Landmarker.
