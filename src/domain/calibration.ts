import {
  FEATURE_KEYS,
  type CalibrationPoint,
  type CalibrationPointId,
  type CalibrationProfile,
  type FeatureVector,
  type FrameFeatures
} from "./types";

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
  | {
      ok: false;
      reason: "insufficient-samples";
      pointId: CalibrationPointId;
    };

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
): boolean {
  return validSamples(samples).length >= minValidSamples;
}

export function buildCalibrationProfile(
  samplesByPoint: SamplesByPoint,
  createdAtMs = Date.now()
): CalibrationBuildResult {
  for (const point of CALIBRATION_POINTS) {
    if (
      !hasEnoughSamplesForPoint(
        samplesByPoint[point.id],
        MIN_VALID_SAMPLES_PER_POINT
      )
    ) {
      return {
        ok: false,
        reason: "insufficient-samples",
        pointId: point.id
      };
    }
  }

  const samples = CALIBRATION_POINTS.flatMap((point) =>
    validSamples(samplesByPoint[point.id])
  );
  const center = vectorFromSamples(samples);
  const tolerance = toleranceFromSamples(samples, center);

  return {
    ok: true,
    profile: {
      createdAtMs,
      minValidSamplesPerPoint: MIN_VALID_SAMPLES_PER_POINT,
      points: CALIBRATION_POINTS.map((point) => point.id),
      center,
      tolerance
    }
  };
}

function isValidSample(sample: FrameFeatures): boolean {
  return (
    sample.faceDetected &&
    FEATURE_KEYS.every((key) => Number.isFinite(sample[key]))
  );
}

function validSamples(samples: FrameFeatures[] | undefined): FrameFeatures[] {
  return samples?.filter(isValidSample) ?? [];
}

function vectorFromSamples(samples: FrameFeatures[]): FeatureVector {
  return Object.fromEntries(
    FEATURE_KEYS.map((key) => [
      key,
      median(samples.map((sample) => sample[key]))
    ])
  ) as FeatureVector;
}

function toleranceFromSamples(
  samples: FrameFeatures[],
  center: FeatureVector
): FeatureVector {
  return Object.fromEntries(
    FEATURE_KEYS.map((key) => {
      const deviations = samples.map((sample) => Math.abs(sample[key] - center[key]));
      const tolerance = percentileValue(deviations, 0.95) * 1.8;

      return [key, Math.max(tolerance, TOLERANCE_FLOORS[key])];
    })
  ) as FeatureVector;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length === 0) {
    return 0;
  }

  if (sorted.length % 2 === 1) {
    return sorted[middleIndex];
  }

  return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
}

function percentileValue(values: number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(percentile * sorted.length) - 1;
  const boundedIndex = Math.min(Math.max(index, 0), sorted.length - 1);

  return sorted[boundedIndex];
}
