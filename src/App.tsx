import { useCallback, useEffect, useRef, useState } from "react";
import { CameraPreview } from "./components/CameraPreview";
import { CalibrationScreen } from "./components/CalibrationScreen";
import { SetupScreen } from "./components/SetupScreen";
import { TestScreen } from "./components/TestScreen";
import { classifyAttention } from "./domain/classifier";
import {
  addEvaluationSample,
  createEvaluationExport,
  summarizeEvaluation,
  type EvaluationLabel,
  type EvaluationSample
} from "./domain/evaluation";
import { createAttentionSmoother, type DisplayAttentionState, type SmootherSnapshot } from "./domain/smoothing";
import { smoothAttentionResult } from "./domain/statePipeline";
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
  const [evaluationSamples, setEvaluationSamples] = useState<EvaluationSample[]>([]);
  const [displayState, setDisplayState] = useState<DisplayAttentionState>("green");
  const [smootherSnapshot, setSmootherSnapshot] = useState<SmootherSnapshot | null>(null);
  const smootherRef = useRef(createAttentionSmoother());
  const evaluationSummary = summarizeEvaluation(evaluationSamples);

  useEffect(() => {
    let disposed = false;
    let loadedTracker: FaceTracker | null = null;

    setTrackerStatus("loading");
    createFaceTracker()
      .then((nextTracker) => {
        if (disposed) {
          nextTracker.dispose();
          return;
        }
        loadedTracker = nextTracker;
        setTracker(nextTracker);
        setTrackerStatus("ready");
        setTrackerError(null);
      })
      .catch(() => {
        if (!disposed) {
          setTrackerStatus("error");
          setTrackerError("The tracker could not be loaded.");
        }
      });

    return () => {
      disposed = true;
      loadedTracker?.dispose();
    };
  }, []);

  const handleFrame = useCallback(
    (features: FrameFeatures | null, timestampMs: number) => {
      setLatestFeatures(features);

      if (mode !== "test" || !profile) {
        return;
      }

      const nextAttention = classifyAttention(features, profile);
      const smoothed = smoothAttentionResult(nextAttention, smootherRef.current, timestampMs);
      setAttention(smoothed.attention);
      setSmootherSnapshot(smoothed.smootherSnapshot);
      setDisplayState(smoothed.displayState);
    },
    [mode, profile]
  );

  const handleTrackerRuntimeError = useCallback(() => {
    setTrackerStatus("error");
    setTrackerError(
      "The tracker could not process webcam frames. MediaPipe needs WebGL support in this browser; try enabling hardware acceleration or using another browser."
    );
    setLatestFeatures(null);
    smootherRef.current.reset();
    setAttention(null);
    setSmootherSnapshot(null);
    setDisplayState("green");
  }, []);

  useAttentionLoop({
    active: camera.status === "ready" && trackerStatus === "ready",
    tracker,
    video,
    onFrame: handleFrame,
    onError: handleTrackerRuntimeError
  });

  const resetTestingState = useCallback(() => {
    smootherRef.current.reset();
    setAttention(null);
    setSmootherSnapshot(null);
    setDisplayState("green");
  }, []);

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

  const beginCalibration = useCallback(() => {
    resetTestingState();
    setEvaluationSamples([]);
    setProfile(null);
    setMode("calibration");
  }, [resetTestingState]);

  const completeCalibration = useCallback(
    (nextProfile: CalibrationProfile) => {
      setProfile(nextProfile);
      resetTestingState();
      setMode("test");
    },
    [resetTestingState]
  );

  const returnToSetup = useCallback(() => {
    resetTestingState();
    setMode("setup");
  }, [resetTestingState]);

  const errorMessage = camera.errorMessage ?? trackerError;
  const hasFace = latestFeatures?.faceDetected ?? false;

  return (
    <>
      <CameraPreview
        stream={camera.stream}
        onVideoReady={setVideo}
        visible={mode === "setup" && camera.status === "ready"}
      />
      {mode === "setup" ? (
        <SetupScreen
          cameraStatus={camera.status}
          trackerStatus={trackerStatus}
          errorMessage={errorMessage}
          hasFace={hasFace}
          onRequestCamera={camera.request}
          onStartCalibration={beginCalibration}
        />
      ) : null}
      {mode === "calibration" ? (
        <CalibrationScreen
          latestFeatures={latestFeatures}
          onComplete={completeCalibration}
          onCancel={returnToSetup}
        />
      ) : null}
      {mode === "test" ? (
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
      ) : null}
    </>
  );
}
