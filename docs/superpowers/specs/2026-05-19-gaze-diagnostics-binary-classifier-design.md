# Gaze Diagnostics And Binary Classifier Design

## Goal

Improve the local webcam attention tracker so it can catch keyboard glances where the student's head stays mostly still and only the eyes move down.

This work covers phases 1 and 2 from the research recommendation:

1. Add diagnostics that reveal whether the current webcam features separate screen-looking from keyboard-looking.
2. Replace the broad distance-only classifier with a calibrated binary screen-vs-keyboard classifier.

## Problem

The current classifier builds one broad screen-looking envelope from the four screen corners plus center, then measures how far live frames are from that envelope. That is too permissive for keyboard detection. Looking at the bottom of the screen and glancing down at the keyboard can be close in the current feature space, especially when the head does not move.

Smoothing cannot fix this by itself because it only stabilizes the raw state. If the raw classifier keeps calling the keyboard glance "looking", smoothing keeps the screen green.

## Phase 1: Diagnostics

The app will expose compact live diagnostics during the full-screen test. The diagnostics should be visible enough for calibration tuning but not dominate the green/red feedback.

Diagnostics include:

- Raw state.
- Tracking score.
- Distance from the calibrated screen profile.
- Distance from the calibrated keyboard profile when keyboard calibration exists.
- Projected keyboard score from 0-ish for screen-looking to 1-ish for keyboard-looking.
- Keyboard separation quality from calibration.
- A simple calibration quality label: weak, usable, strong.

These values are local-only and in-memory. No frames, images, metrics, or calibration data leave the browser.

## Phase 2: Binary Classifier

The app will keep MediaPipe Face Landmarker as the tracker, but it will extract a richer feature vector:

- Existing head/face signals: pitch, yaw, face center, face scale.
- Existing aggregate eye signals: average vertical and horizontal iris position.
- New per-eye iris signals: left/right vertical and horizontal iris position.
- New eye aperture signals: left/right eye openness.

Calibration will continue to collect five screen points plus one keyboard point. The profile will still contain screen and keyboard centers, but the classifier will also derive a screen-to-keyboard projection axis from those centers. A live frame is classified as keyboard-looking when:

- The keyboard calibration has enough separation to be trusted.
- The frame projects far enough along the screen-to-keyboard axis.
- The keyboard profile is closer than the screen profile, or the projection strongly indicates keyboard-looking.

The existing smoothing behavior stays in place. The classifier becomes more sensitive to sustained keyboard-looking evidence, while the smoother still prevents flicker from blinks or one-frame noise.

## UI

The full-screen test remains the primary experience:

- Green means looking at screen.
- Red means looking away, looking at keyboard, or face missing after smoothing.

The diagnostics panel appears as a compact fixed panel on the test screen. It should be readable during manual testing and small enough that the main green/red state is still obvious. Recalibration remains available.

## Testing

Automated tests cover:

- Rich feature extraction from synthetic MediaPipe landmarks.
- Calibration profile creation with keyboard separation quality.
- Classifier behavior for eye-only keyboard glances.
- Classifier behavior for bottom-screen-like frames that should remain looking.
- Diagnostic fields returned with attention results.
- Test screen rendering of diagnostic metrics.

Manual verification covers:

- Camera starts.
- Calibration completes.
- Diagnostics update during test mode.
- Looking at screen stays green.
- Sustained keyboard glance turns red.
- Recalibration resets the model.

## Out Of Scope

- Adding WebEyeTrack or TensorFlow.js in this phase.
- Recording video or screenshots.
- Uploading telemetry.
- Teacher dashboard or student records.
- Exact gaze cursor.
- Typing lesson integration.

## Success Criteria

The phase succeeds when the app can show whether calibration produced a meaningful screen-vs-keyboard separation, and when sustained eye-only keyboard glances are more likely to produce red feedback without making normal bottom-screen viewing immediately fail.
