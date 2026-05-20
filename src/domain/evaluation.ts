import type {
  AttentionResult,
  FrameFeatures,
  KeyboardCalibrationQuality,
  RawAttentionState
} from "./types";
import type { DisplayAttentionState, SmootherSnapshot } from "./smoothing";

export const EVALUATION_LABELS = [
  "screen-center",
  "screen-bottom",
  "keyboard",
  "off-left",
  "off-right",
  "lean-left",
  "lean-right",
  "low-light"
] as const;

export type EvaluationLabel = (typeof EVALUATION_LABELS)[number];

const SCREEN_LABELS = new Set<EvaluationLabel>([
  "screen-center",
  "screen-bottom",
  "lean-left",
  "lean-right",
  "low-light"
]);

const AWAY_LABELS = new Set<EvaluationLabel>(["keyboard", "off-left", "off-right"]);

export type EvaluationSample = {
  id: string;
  timestampMs: number;
  label: EvaluationLabel;
  features: FrameFeatures | null;
  rawState: RawAttentionState;
  displayState: DisplayAttentionState;
  awayDurationMs: number;
  trackingScore: number;
  screenDistance?: number;
  keyboardDistance?: number;
  keyboardScore?: number;
  keyboardSeparation?: number;
  keyboardQuality?: KeyboardCalibrationQuality;
};

export type EvaluationSummaryByLabel = {
  sampleCount: number;
  lookingPercent: number;
  unknownPercent: number;
  awayPercent: number;
  faceMissingPercent: number;
  medianTrackingScore: number | null;
  medianKeyboardScore: number | null;
};

export type EvaluationSummary = {
  totalSamples: number;
  falseLookingRate: number | null;
  falseAwayRate: number | null;
  labels: Record<EvaluationLabel, EvaluationSummaryByLabel>;
};

export type EvaluationExport = {
  version: 1;
  createdAtMs: number;
  summary: EvaluationSummary;
  samples: EvaluationSample[];
};

type AddEvaluationSampleInput = {
  label: EvaluationLabel;
  timestampMs: number;
  features: FrameFeatures | null;
  attention: AttentionResult;
  smootherSnapshot: SmootherSnapshot;
};

export function addEvaluationSample(
  samples: EvaluationSample[],
  input: AddEvaluationSampleInput
): EvaluationSample[] {
  return [
    ...samples,
    {
      id: `${input.timestampMs}-${samples.length + 1}`,
      timestampMs: input.timestampMs,
      label: input.label,
      features: input.features,
      rawState: input.attention.rawState,
      displayState: input.smootherSnapshot.displayState,
      awayDurationMs: input.smootherSnapshot.awayDurationMs,
      trackingScore: input.attention.trackingScore,
      screenDistance: input.attention.screenDistance ?? input.attention.distance,
      keyboardDistance: input.attention.keyboardDistance,
      keyboardScore: input.attention.keyboardScore,
      keyboardSeparation: input.attention.keyboardSeparation,
      keyboardQuality: input.attention.keyboardQuality
    }
  ];
}

export function summarizeEvaluation(samples: EvaluationSample[]): EvaluationSummary {
  const labels = Object.fromEntries(
    EVALUATION_LABELS.map((label) => [label, summarizeLabel(samples, label)])
  ) as Record<EvaluationLabel, EvaluationSummaryByLabel>;

  const awaySamples = samples.filter((sample) => AWAY_LABELS.has(sample.label));
  const screenSamples = samples.filter((sample) => SCREEN_LABELS.has(sample.label));

  return {
    totalSamples: samples.length,
    falseLookingRate: rate(
      awaySamples.filter((sample) => sample.rawState === "looking").length,
      awaySamples.length
    ),
    falseAwayRate: rate(
      screenSamples.filter((sample) => sample.rawState === "away").length,
      screenSamples.length
    ),
    labels
  };
}

export function createEvaluationExport(
  samples: EvaluationSample[],
  createdAtMs = Date.now()
): EvaluationExport {
  return {
    version: 1,
    createdAtMs,
    summary: summarizeEvaluation(samples),
    samples
  };
}

function summarizeLabel(
  samples: EvaluationSample[],
  label: EvaluationLabel
): EvaluationSummaryByLabel {
  const labelSamples = samples.filter((sample) => sample.label === label);

  return {
    sampleCount: labelSamples.length,
    lookingPercent: statePercent(labelSamples, "looking"),
    unknownPercent: statePercent(labelSamples, "unknown"),
    awayPercent: statePercent(labelSamples, "away"),
    faceMissingPercent: statePercent(labelSamples, "face-missing"),
    medianTrackingScore: median(labelSamples.map((sample) => sample.trackingScore)),
    medianKeyboardScore: median(
      labelSamples
        .map((sample) => sample.keyboardScore)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    )
  };
}

function statePercent(samples: EvaluationSample[], rawState: RawAttentionState): number {
  return rate(samples.filter((sample) => sample.rawState === rawState).length, samples.length) ?? 0;
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function median(values: number[]): number | null {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);

  if (finite.length === 0) {
    return null;
  }

  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 === 1 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2;
}
