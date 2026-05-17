import { useEffect, useRef, useState } from "react";
import {
  buildCalibrationProfile,
  CALIBRATION_POINTS,
  hasEnoughSamplesForPoint,
  type SamplesByPoint
} from "../domain/calibration";
import type { CalibrationPointId, CalibrationProfile, FrameFeatures } from "../domain/types";

type CalibrationScreenProps = {
  latestFeatures: FrameFeatures | null;
  onComplete: (profile: CalibrationProfile) => void;
  onCancel: () => void;
};

const POINT_DURATION_MS = 2000;

export function CalibrationScreen({
  latestFeatures,
  onComplete,
  onCancel
}: CalibrationScreenProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState(POINT_DURATION_MS);
  const [retryPointId, setRetryPointId] = useState<CalibrationPointId | null>(null);
  const activeIndexRef = useRef(0);
  const pointStartedAtRef = useRef<number | null>(null);
  const lastSampleTimestampRef = useRef<number | null>(null);
  const samplesByPointRef = useRef<SamplesByPoint>({});
  const latestFeaturesRef = useRef<FrameFeatures | null>(latestFeatures);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);

  latestFeaturesRef.current = latestFeatures;

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    pointStartedAtRef.current = null;
    lastSampleTimestampRef.current = null;
    setRemainingMs(POINT_DURATION_MS);
  }, [activeIndex]);

  useEffect(() => {
    let frameId: number | null = null;
    let stopped = false;

    const tick = (timestampMs: number) => {
      if (stopped) {
        return;
      }

      const activePoint = CALIBRATION_POINTS[activeIndexRef.current];
      pointStartedAtRef.current ??= timestampMs;

      const latest = latestFeaturesRef.current;
      if (
        latest?.faceDetected &&
        latest.timestampMs >= pointStartedAtRef.current &&
        lastSampleTimestampRef.current !== latest.timestampMs
      ) {
        lastSampleTimestampRef.current = latest.timestampMs;
        const currentSamples = samplesByPointRef.current[activePoint.id] ?? [];
        samplesByPointRef.current = {
          ...samplesByPointRef.current,
          [activePoint.id]: [...currentSamples, { ...latest, point: activePoint.id }]
        };
      }

      const elapsedMs = timestampMs - pointStartedAtRef.current;
      setRemainingMs(Math.max(0, POINT_DURATION_MS - elapsedMs));

      if (elapsedMs >= POINT_DURATION_MS) {
        advance(activePoint.id);
      }

      if (completedRef.current) {
        return;
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);

  const activePoint = CALIBRATION_POINTS[activeIndex];
  const countdownSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

  function advance(pointId: CalibrationPointId) {
    const samples = samplesByPointRef.current[pointId];
    pointStartedAtRef.current = null;
    lastSampleTimestampRef.current = null;

    if (!hasEnoughSamplesForPoint(samples)) {
      setRetryPointId(pointId);
      samplesByPointRef.current = {
        ...samplesByPointRef.current,
        [pointId]: []
      };
      setRemainingMs(POINT_DURATION_MS);
      return;
    }

    const nextIndex = activeIndexRef.current + 1;
    if (nextIndex < CALIBRATION_POINTS.length) {
      setRetryPointId(null);
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
      return;
    }

    const result = buildCalibrationProfile(samplesByPointRef.current);
    if (result.ok) {
      completedRef.current = true;
      onCompleteRef.current(result.profile);
      return;
    }

    const retryIndex = CALIBRATION_POINTS.findIndex(
      (point) => point.id === result.pointId
    );
    setRetryPointId(result.pointId);
    samplesByPointRef.current = {
      ...samplesByPointRef.current,
      [result.pointId]: []
    };
    activeIndexRef.current = retryIndex;
    setActiveIndex(retryIndex);
  }

  return (
    <main className="calibration-shell">
      <div className="calibration-topbar">
        <div>
          <p className="eyebrow">Calibration</p>
          <h1>{activePoint.label}</h1>
        </div>
        <button className="secondary-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div
        className="calibration-dot"
        style={{
          left: `clamp(54px, ${activePoint.xPercent}%, calc(100% - 54px))`,
          top: `clamp(150px, ${activePoint.yPercent}%, calc(100% - 154px))`
        }}
        aria-label={`Look at ${activePoint.label}`}
      />

      <div className="calibration-status" aria-live="polite">
        <span className="countdown">{countdownSeconds}</span>
        <span>{retryPointId === activePoint.id ? "Retrying dot" : "Keep looking at the dot"}</span>
      </div>
    </main>
  );
}
