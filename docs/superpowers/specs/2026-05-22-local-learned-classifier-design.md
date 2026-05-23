# Local Learned Classifier Design

## Goal

Improve keyboard-looking detection by replacing the most fragile hand-tuned keyboard projection rule with a tiny learned classifier trained locally from the current calibration session.

The model must preserve the project's core promise:

- Browser-based.
- Local-only.
- No backend or server-side gaze processing.
- No webcam frame uploads.
- Lightweight enough for a laptop webcam.
- Easy to evaluate with the existing labeled evaluation workflow.

## Context

The current app uses MediaPipe Face Landmarker in the browser to extract numeric face and eye features. Calibration captures five screen-looking points plus one keyboard-looking point. The classifier then compares live frames to a pooled screen profile, applies side-gaze guardrails, and uses a hand-built keyboard projection score to catch downward glances.

That approach improved over the first threshold-only version, but it is still brittle. The projection score assumes one screen-to-keyboard axis, and it is sensitive to calibration quality and feature weighting. A small learned classifier can use the same calibration samples more directly: screen-looking examples define the screen class, and keyboard-looking examples define the keyboard/down class.

This is not a heavy machine-learning feature. It is an in-memory, per-calibration classifier over existing numeric feature vectors.

## Accepted Approach

Use a calibration-trained nearest-centroid classifier.

The rejected alternatives for this first phase are:

- **Evaluation-trained classifier:** More powerful, but it needs a new "train from collected samples" workflow, data quality controls, and clearer user consent around saved samples.
- **Pretrained gaze model:** Potentially useful later, but it adds dependency and runtime risk before the current MediaPipe feature pipeline has been fully exploited.
- **Backend model service:** Not aligned with the privacy and local-first goals of this project.

## Feature Scope

The learned model trains fresh each time calibration completes. It is not persisted between browser sessions.

Positive examples:

- Valid feature samples from the five screen calibration points.

Negative examples:

- Valid feature samples from the keyboard calibration point.

The learned model should use gaze-attention features and avoid face-placement features as primary distance inputs:

- `pitch`
- `yaw`
- `eyeVertical`
- `eyeHorizontal`
- `leftEyeVertical`
- `rightEyeVertical`
- `leftEyeHorizontal`
- `rightEyeHorizontal`
- `leftEyeOpenness`
- `rightEyeOpenness`

The model should not use these as core learned-distance features:

- `faceCenterX`
- `faceCenterY`
- `faceScale`

Face center and scale remain useful diagnostics and quality gates, but including them in the learned gaze distance can make leaning or laptop movement look like attention changes.

## Data Model

Add an optional learned model to `CalibrationProfile`.

Recommended shape:

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

`featureKeys` defines the subset used by the learned model. `screenCenter` and `keyboardCenter` are medians. `scale` is a robust per-feature normalizer built from the combined screen and keyboard samples, with sensible floors matching the existing calibration tolerance floors. `screenRadius` and `keyboardRadius` describe typical within-class distances so the classifier can distinguish confident and ambiguous frames. `keyboardSeparation` measures the normalized distance between the two class centers.

The profile should continue storing the existing `center`, `tolerance`, `keyboardCenter`, `keyboardTolerance`, `keyboardSeparation`, and `keyboardQuality` fields so existing diagnostics and fallback behavior remain available.

## Classifier Behavior

The classifier flow should become:

```text
features
  -> face/finite-value validation
  -> screen distance diagnostics
  -> side-gaze guardrail
  -> learned screen-vs-keyboard classification when available
  -> fallback distance classification when unavailable or ambiguous
  -> smoothing
```

Rules:

1. If the face is missing, return `face-missing`.
2. If required features are non-finite, return `unknown`.
3. Compute existing screen distance and side-gaze diagnostics.
4. If strong side gaze indicates off-screen attention, return `away`.
5. If a learned model exists and has usable class separation:
   - Return `away` when the current frame is meaningfully closer to keyboard than screen.
   - Return `looking` when the current frame is clearly close to screen and not keyboard-dominant.
   - Return `unknown` when screen and keyboard distances are too close to call.
6. If the learned model is unavailable or not decisive, fall back to the current screen-distance classifier and existing keyboard diagnostics.

The learned model should expose diagnostics in `AttentionResult`:

- `learnedScreenDistance`
- `learnedKeyboardDistance`
- `learnedKeyboardScore`
- `learnedMargin`
- `learnedModelSeparation`

`learnedKeyboardScore` should be a bounded 0-1 value, where higher means the frame looks more like the calibrated keyboard class than the calibrated screen class.

## Calibration Behavior

`buildCalibrationProfile()` should build the learned model only when keyboard samples are present and valid.

If keyboard separation is weak, the app already asks the user to retry keyboard calibration. The learned model should still record its separation diagnostics, but `classifyAttention()` should only trust the learned model when separation is at least usable.

If calibration has no keyboard samples, the app should behave as it does today.

## UI Behavior

The first learned-model phase should not add new visible workflow steps.

The existing calibration flow remains:

1. Top left.
2. Top right.
3. Bottom right.
4. Bottom left.
5. Center.
6. Keyboard.

The existing full-screen test remains green/red.

The diagnostics display can show learned-model values if available, but the core user-facing experience should stay quiet. The app should not introduce a "train model" button yet because the model trains automatically at calibration completion.

## Privacy

This feature preserves the local-only privacy model.

- The model is trained in memory from numeric calibration features.
- Webcam frames stay in the browser.
- No images, video, calibration data, model data, or evaluation exports are uploaded.
- No server endpoint is added.
- No model persistence is added in this phase.

The README privacy promise remains accurate after this feature.

## Error Handling

If learned-model fields are missing, malformed, or non-finite, classification should ignore the learned model and use the existing fallback behavior.

If the learned model produces ambiguous distances, classification should return `unknown` instead of forcing a red or green state.

If keyboard calibration is weak, calibration retry remains the primary quality control.

If a future evaluation export includes learned diagnostics, older analyzer behavior should continue working with samples that lack those fields.

## Testing

Automated tests should cover:

- Calibration builds a learned model when valid keyboard samples exist.
- Calibration omits or distrusts the learned model when keyboard samples are missing or weak.
- Learned model distance uses the selected gaze-attention feature keys and excludes face center and scale.
- Keyboard-like eye-only glances classify as `away`.
- Screen-bottom-like samples stay `looking` when they are closer to the screen class.
- Ambiguous samples classify as `unknown`.
- Invalid or missing learned model data falls back safely.
- Attention results include learned-model diagnostics when the model is used.
- Evaluation samples and analyzer output tolerate optional learned diagnostics.

Manual verification should cover:

- Calibrate normally.
- Confirm the full-screen test still stays green at screen center.
- Confirm bottom-screen viewing is not immediately punished.
- Confirm sustained keyboard-looking turns red more reliably than the previous projection rule.
- Export evaluation samples and compare false-looking and false-away rates against the previous baseline.

## Success Criteria

This phase succeeds when:

- The app remains browser-only and local-only.
- Calibration automatically creates a usable learned screen-vs-keyboard classifier when keyboard data is good.
- Sustained keyboard-looking is more likely to classify as `away`.
- Normal screen-looking, including screen bottom, remains mostly `looking`.
- Ambiguous frames remain `unknown` so smoothing can avoid flicker.
- Existing evaluation exports can measure whether false-looking improved.

## Out Of Scope

- Backend inference.
- Uploading webcam frames, images, recordings, calibration profiles, or exported samples.
- Saving learned models across sessions.
- Training from evaluation samples.
- Adding TensorFlow.js, ONNX Runtime, WebEyeTrack, Human, L2CS-Net, OpenFace, or a Python process.
- Exact gaze-coordinate prediction.
- Teacher dashboards, accounts, or student records.
