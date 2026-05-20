export const BASELINE_TARGET_COUNT = 20;

export const EVALUATION_LABEL_METADATA = {
  "screen-center": {
    displayName: "Screen center",
    role: "screen",
    targetCount: BASELINE_TARGET_COUNT
  },
  "screen-bottom": {
    displayName: "Screen bottom",
    role: "screen",
    targetCount: BASELINE_TARGET_COUNT
  },
  keyboard: {
    displayName: "Keyboard",
    role: "away",
    targetCount: BASELINE_TARGET_COUNT
  },
  "off-left": {
    displayName: "Off left",
    role: "away",
    targetCount: BASELINE_TARGET_COUNT
  },
  "off-right": {
    displayName: "Off right",
    role: "away",
    targetCount: BASELINE_TARGET_COUNT
  },
  "lean-left": {
    displayName: "Lean left",
    role: "screen",
    targetCount: BASELINE_TARGET_COUNT
  },
  "lean-right": {
    displayName: "Lean right",
    role: "screen",
    targetCount: BASELINE_TARGET_COUNT
  },
  "low-light": {
    displayName: "Low light",
    role: "screen",
    targetCount: BASELINE_TARGET_COUNT
  }
};

export const EVALUATION_LABELS = Object.keys(EVALUATION_LABEL_METADATA);

export function validateEvaluationPayload(payload, filePath = "payload") {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${filePath} must contain an evaluation export object.`);
  }

  if (payload.version !== 1) {
    throw new Error(`${filePath} must be an evaluation export with version === 1.`);
  }

  if (!Array.isArray(payload.samples)) {
    throw new Error(`${filePath} must include a samples array.`);
  }

  return payload;
}

export function analyzeEvaluationPayloads(payloads, fileCount = payloads.length) {
  const samples = payloads.flatMap((payload) => payload.samples);
  const awaySamples = samples.filter((sample) => labelHasRole(sample.label, "away"));
  const screenSamples = samples.filter((sample) => labelHasRole(sample.label, "screen"));
  const falseLookingCount = countRawState(awaySamples, "looking");
  const falseAwayCount = countRawState(screenSamples, "away");
  const labels = Object.fromEntries(
    EVALUATION_LABELS.map((label) => [label, analyzeLabel(samples, label)])
  );
  const targetSamples = EVALUATION_LABELS.reduce(
    (total, label) => total + EVALUATION_LABEL_METADATA[label].targetCount,
    0
  );
  const remainingSamples = Object.values(labels).reduce(
    (total, label) => total + label.remainingCount,
    0
  );

  return {
    fileCount,
    totalSamples: samples.length,
    targetSamples,
    completedLabels: Object.values(labels).filter((label) => label.isComplete).length,
    remainingSamples,
    isComplete: remainingSamples === 0,
    falseLookingCount,
    falseLookingDenominator: awaySamples.length,
    falseLookingRate: rate(falseLookingCount, awaySamples.length),
    falseAwayCount,
    falseAwayDenominator: screenSamples.length,
    falseAwayRate: rate(falseAwayCount, screenSamples.length),
    labels
  };
}

export function formatEvaluationAnalysis(analysis) {
  const lines = [
    "Evaluation export analysis",
    `Files: ${analysis.fileCount}`,
    `Total samples: ${formatTargetProgress(analysis)}`,
    `False-looking rate: ${formatPercent(analysis.falseLookingRate)} (${analysis.falseLookingCount}/${analysis.falseLookingDenominator} away-role samples)`,
    `False-away rate: ${formatPercent(analysis.falseAwayRate)} (${analysis.falseAwayCount}/${analysis.falseAwayDenominator} screen-role samples)`,
    "",
    "Per-label rows:",
    table([
      [
        "Label",
        "Role",
        "Count",
        "Target",
        "Remaining",
        "Looking",
        "Unknown",
        "Away",
        "Face missing",
        "Median tracking",
        "Median keyboard"
      ],
      ...EVALUATION_LABELS.map((label) => {
        const row = analysis.labels[label];

        return [
          row.displayName,
          row.role,
          row.count.toString(),
          row.targetCount.toString(),
          row.remainingCount.toString(),
          formatPercent(row.lookingPercent),
          formatPercent(row.unknownPercent),
          formatPercent(row.awayPercent),
          formatPercent(row.faceMissingPercent),
          formatScore(row.medianTrackingScore),
          formatScore(row.medianKeyboardScore)
        ];
      })
    ])
  ];

  return `${lines.join("\n")}\n`;
}

function analyzeLabel(samples, label) {
  const metadata = EVALUATION_LABEL_METADATA[label];
  const labelSamples = samples.filter((sample) => sample.label === label);
  const remainingCount = Math.max(0, metadata.targetCount - labelSamples.length);

  return {
    displayName: metadata.displayName,
    role: metadata.role,
    targetCount: metadata.targetCount,
    remainingCount,
    isComplete: remainingCount === 0,
    count: labelSamples.length,
    lookingPercent: statePercent(labelSamples, "looking"),
    unknownPercent: statePercent(labelSamples, "unknown"),
    awayPercent: statePercent(labelSamples, "away"),
    faceMissingPercent: statePercent(labelSamples, "face-missing"),
    medianTrackingScore: median(labelSamples.map((sample) => sample.trackingScore)),
    medianKeyboardScore: median(labelSamples.map((sample) => sample.keyboardScore))
  };
}

function labelHasRole(label, role) {
  return EVALUATION_LABEL_METADATA[label]?.role === role;
}

function countRawState(samples, rawState) {
  return samples.filter((sample) => sample.rawState === rawState).length;
}

function statePercent(samples, rawState) {
  return rate(countRawState(samples, rawState), samples.length) ?? 0;
}

function rate(numerator, denominator) {
  if (denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function median(values) {
  const finite = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  finite.sort((left, right) => left - right);

  if (finite.length === 0) {
    return null;
  }

  const middle = Math.floor(finite.length / 2);

  if (finite.length % 2 === 1) {
    return finite[middle];
  }

  return (finite[middle - 1] + finite[middle]) / 2;
}

function formatPercent(value) {
  if (value === null) {
    return "n/a";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatScore(value) {
  if (value === null) {
    return "n/a";
  }

  return value.toFixed(3);
}

function formatTargetProgress(analysis) {
  if (typeof analysis.targetSamples !== "number") {
    return analysis.totalSamples.toString();
  }

  if (typeof analysis.remainingSamples !== "number") {
    return `${analysis.totalSamples}/${analysis.targetSamples} target`;
  }

  return `${analysis.totalSamples}/${analysis.targetSamples} target (${analysis.remainingSamples} remaining)`;
}

function table(rows) {
  const widths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map((row) => row[columnIndex].length))
  );

  return rows
    .map((row) =>
      row.map((cell, columnIndex) => cell.padEnd(widths[columnIndex])).join("  ").trimEnd()
    )
    .join("\n");
}
