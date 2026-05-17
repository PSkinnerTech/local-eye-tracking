# Webcam Attention Tracker Design

## Goal

Build a lightweight, local-only browser web app that uses a laptop webcam to tell whether a typing student appears to be looking at the screen or looking away/down at their hands or keyboard.

The first version is intentionally binary. It does not estimate an exact gaze point, record video, upload webcam frames, store student records, or integrate with typing lessons.

## Product Flow

The app moves through four states:

1. Setup
2. Camera ready
3. Calibration
4. Full-screen test

In setup, the app loads the tracking model and requests webcam permission. Once the webcam is available and a face is detected, the user can begin calibration.

During calibration, the app shows five dots automatically:

1. Top-left corner
2. Top-right corner
3. Bottom-right corner
4. Bottom-left corner
5. Center

Each dot is shown with a short countdown, targeting about two seconds. During the countdown, the app samples face and eye features from webcam frames when a face is detected. If too few valid samples are collected for a dot, that dot is retried instead of saving noisy calibration data.

After calibration succeeds, the app enters a full-window test screen. The screen is green when the student appears to be looking at the screen and red when the student appears to be looking away or down. The feedback is forgiving: brief uncertainty, blinks, and quick glances do not immediately turn the screen red.

## Architecture

Use a React + TypeScript browser app, with Vite as the default project scaffold because the workspace is empty and the tool is a focused client-side experience.

The app is organized around a small state machine:

```text
Setup -> CameraReady -> Calibration -> Test
```

Core modules:

- `CameraFeed`: requests webcam access, owns the local video element, and reports camera permission or device errors.
- `FaceTracker`: wraps MediaPipe Face Landmarker for browser use and emits lightweight per-frame features derived from detected face landmarks.
- `CalibrationFlow`: owns the five-dot sequence, countdowns, valid sample collection, retry behavior, and final calibration profile creation.
- `AttentionClassifier`: compares live features against the calibration profile and produces a binary attention state plus a confidence value.
- `TestScreen`: renders the green/red full-screen feedback and small status text.

All webcam processing runs in the browser. No webcam frame, image, recording, biometric template, or student data is sent to a server. Calibration data is held in memory for the current session only.

## Tracking Strategy

Use MediaPipe Face Landmarker rather than a precise gaze-estimation library. The target use case is not "where exactly on the screen is the student looking?" The target use case is "does the student appear to be looking at the screen or down/away?"

The app derives a compact feature vector from each valid frame. Candidate features include:

- Head pitch and yaw estimates relative to the calibrated screen-looking posture.
- Eye or iris position relative to nearby eye landmarks when those landmarks are available.
- Face bounding area and center shift, used as weak stability signals.
- Face presence or absence.

Calibration builds a screen-looking profile from the five guided positions. The corners help capture reasonable screen-looking variation across the display, and the center point gives a strong neutral reference. The first implementation should use simple statistics, such as medians and tolerances, rather than training a complex model.

The classifier produces one of these raw states per frame:

- `looking`
- `away`
- `unknown`
- `face-missing`

The raw state is then smoothed before it controls the UI.

## Smoothing Behavior

The test screen should not flicker. The user-visible state stays green through short interruptions and turns red only after continuous away evidence.

Default smoothing:

- Turn red after about 900ms of continuous `away` or `face-missing` evidence.
- Return green quickly once valid `looking` evidence resumes.
- Treat `unknown` as a temporary hold state for short periods, then degrade toward red if uncertainty continues.

This default sits inside the requested 0.75-1.0 second forgiving range.

## User Interface

The first screen is the usable app, not a marketing page.

Setup shows camera/model readiness, camera permission errors if any, and the primary action to begin calibration once ready.

Calibration uses a full-window layout with one large, high-contrast dot at a time. The dot appears near the active calibration target, and a visible countdown tells the user to keep looking at it. The UI should avoid instructional clutter while still making the current action obvious.

The test screen is visually simple:

- Green background for looking at screen.
- Red background for looking away/down or face missing after smoothing.
- Small unobtrusive status text such as "Looking at screen", "Looking away", or "Face not detected".
- A reset/recalibrate control.

## Error Handling

The app handles these conditions explicitly:

- Camera permission denied: explain that camera access is required and offer retry.
- No camera found: show a device error and keep the app in setup.
- Model load failure: show a load error and retry option.
- Face not detected before calibration: keep waiting and show concise status.
- Face not detected during a calibration dot: pause or retry that dot.
- Too few valid samples for a calibration dot: retry that dot automatically.
- Calibration profile too noisy: ask the user to recalibrate.
- Face missing during test: after smoothing, show the red state and "Face not detected".

## Testing Plan

Automated tests should cover the logic that can be tested without a physical webcam:

- Calibration profile generation from synthetic feature samples.
- Classifier output for clear looking, away, unknown, and face-missing inputs.
- Smoothing behavior, including the 900ms away threshold and quick return to green.
- Calibration retry decisions when valid sample counts are too low.

Manual browser verification should cover:

- Webcam permission request.
- Camera preview and model readiness.
- Five-dot calibration sequence in the correct order.
- Automatic countdown and retry behavior.
- Green screen while looking at the screen.
- Red screen after looking down or away for about one second.
- Recalibration flow.

## Out Of Scope For The First Version

- User accounts.
- Student records.
- Cloud storage.
- Analytics.
- Video recording.
- Exact gaze cursor or heatmap.
- Typing lesson integration.
- Teacher dashboard.
- Multi-camera support.

## Success Criteria

The first version is successful when a user can open the local web app, grant webcam permission, complete the five-dot calibration, and run a full-screen test where the screen remains green while they look at the screen and turns red after they look down or away for roughly one second.
