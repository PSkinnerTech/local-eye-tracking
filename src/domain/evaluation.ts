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

export const BASELINE_TARGET_COUNT = 20;

export type EvaluationLabelRole = "screen" | "away";

export type EvaluationLabelMetadata = {
  displayName: string;
  role: EvaluationLabelRole;
  targetCount: number;
  instruction: string;
};

export const EVALUATION_LABEL_METADATA: Record<EvaluationLabel, EvaluationLabelMetadata> = {
  "screen-center": {
    displayName: "Screen center",
    role: "screen",
    targetCount: BASELINE_TARGET_COUNT,
    instruction: "Look naturally at the middle of the screen."
  },
  "screen-bottom": {
    displayName: "Screen bottom",
    role: "screen",
    targetCount: BASELINE_TARGET_COUNT,
    instruction: "Look at the lower area of the screen."
  },
  keyboard: {
    displayName: "Keyboard",
    role: "away",
    targetCount: BASELINE_TARGET_COUNT,
    instruction: "Look down toward the keyboard."
  },
  "off-left": {
    displayName: "Off left",
    role: "away",
    targetCount: BASELINE_TARGET_COUNT,
    instruction: "Look away to the left of the screen."
  },
  "off-right": {
    displayName: "Off right",
    role: "away",
    targetCount: BASELINE_TARGET_COUNT,
    instruction: "Look away to the right of the screen."
  },
  "lean-left": {
    displayName: "Lean left",
    role: "screen",
    targetCount: BASELINE_TARGET_COUNT,
    instruction: "Lean left while keeping attention on the screen."
  },
  "lean-right": {
    displayName: "Lean right",
    role: "screen",
    targetCount: BASELINE_TARGET_COUNT,
    instruction: "Lean right while keeping attention on the screen."
  },
  "low-light": {
    displayName: "Low light",
    role: "screen",
    targetCount: BASELINE_TARGET_COUNT,
    instruction: "Look at the screen under dimmer lighting."
  }
};

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
  sideGazeScore?: number;
  sideGazeDirection?: "left" | "right";
  keyboardDistance?: number;
  keyboardScore?: number;
  keyboardSeparation?: number;
  keyboardQuality?: KeyboardCalibrationQuality;
};

export type EvaluationSummaryByLabel = {
  displayName?: string;
  role?: EvaluationLabelRole;
  targetCount?: number;
  remainingCount?: number;
  isComplete?: boolean;
  sampleCount: number;
  lookingPercent: number;
  unknownPercent: number;
  awayPercent: number;
  faceMissingPercent: number;
  medianTrackingScore: number | null;
  medianSideGazeScore: number | null;
  medianKeyboardScore: number | null;
};

export type EvaluationSummary = {
  totalSamples: number;
  targetSamples?: number;
  balancedSampleCount?: number;
  extraSamples?: number;
  completedLabels?: number;
  remainingSamples?: number;
  isComplete?: boolean;
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
  enforceTarget?: boolean;
};

export function addEvaluationSample(
  samples: EvaluationSample[],
  input: AddEvaluationSampleInput
): EvaluationSample[] {
  const metadata = EVALUATION_LABEL_METADATA[input.label];
  const currentLabelSamples = samples.filter((sample) => sample.label === input.label).length;

  if (input.enforceTarget !== false && currentLabelSamples >= metadata.targetCount) {
    return samples;
  }

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
      sideGazeScore: input.attention.sideGazeScore,
      sideGazeDirection: input.attention.sideGazeDirection,
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

  const awaySamples = samples.filter(
    (sample) => EVALUATION_LABEL_METADATA[sample.label].role === "away"
  );
  const screenSamples = samples.filter(
    (sample) => EVALUATION_LABEL_METADATA[sample.label].role === "screen"
  );
  const targetSamples = EVALUATION_LABELS.reduce(
    (total, label) => total + EVALUATION_LABEL_METADATA[label].targetCount,
    0
  );
  const balancedSampleCount = EVALUATION_LABELS.reduce((total, label) => {
    const labelSummary = labels[label];

    return total + Math.min(labelSummary.sampleCount, labelSummary.targetCount ?? 0);
  }, 0);
  const completedLabels = EVALUATION_LABELS.filter((label) => labels[label].isComplete).length;
  const remainingSamples = EVALUATION_LABELS.reduce(
    (total, label) => total + (labels[label].remainingCount ?? 0),
    0
  );

  return {
    totalSamples: samples.length,
    targetSamples,
    balancedSampleCount,
    extraSamples: Math.max(0, samples.length - balancedSampleCount),
    completedLabels,
    remainingSamples,
    isComplete: remainingSamples === 0,
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

export function evaluationExportFilename(payload: EvaluationExport): string {
  const createdAt = new Date(payload.createdAtMs);
  const date = [
    createdAt.getFullYear(),
    padDatePart(createdAt.getMonth() + 1),
    padDatePart(createdAt.getDate())
  ].join("-");
  const time = [
    padDatePart(createdAt.getHours()),
    padDatePart(createdAt.getMinutes()),
    padDatePart(createdAt.getSeconds())
  ].join("-");

  return `eyes-baseline-eval-${date}T${time}-${payload.samples.length}samples.json`;
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
  const metadata = EVALUATION_LABEL_METADATA[label];
  const labelSamples = samples.filter((sample) => sample.label === label);
  const remainingCount = Math.max(0, metadata.targetCount - labelSamples.length);

  return {
    displayName: metadata.displayName,
    role: metadata.role,
    targetCount: metadata.targetCount,
    remainingCount,
    isComplete: remainingCount === 0,
    sampleCount: labelSamples.length,
    lookingPercent: statePercent(labelSamples, "looking"),
    unknownPercent: statePercent(labelSamples, "unknown"),
    awayPercent: statePercent(labelSamples, "away"),
    faceMissingPercent: statePercent(labelSamples, "face-missing"),
    medianTrackingScore: median(labelSamples.map((sample) => sample.trackingScore)),
    medianSideGazeScore: median(
      labelSamples
        .map((sample) => sample.sideGazeScore)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    ),
    medianKeyboardScore: median(
      labelSamples
        .map((sample) => sample.keyboardScore)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    )
  };
}

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0");
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
