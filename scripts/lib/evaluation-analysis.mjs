const EVALUATION_LABELS = [
  "screen-center",
  "screen-bottom",
  "keyboard",
  "off-left",
  "off-right",
  "lean-left",
  "lean-right",
  "low-light"
];

const AWAY_LABELS = new Set(["keyboard", "off-left", "off-right"]);
const SCREEN_LABELS = new Set([
  "screen-center",
  "screen-bottom",
  "lean-left",
  "lean-right",
  "low-light"
]);

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
  const awaySamples = samples.filter((sample) => AWAY_LABELS.has(sample.label));
  const screenSamples = samples.filter((sample) => SCREEN_LABELS.has(sample.label));

  return {
    fileCount,
    totalSamples: samples.length,
    falseLookingCount: countRawState(awaySamples, "looking"),
    falseLookingDenominator: awaySamples.length,
    falseLookingRate: rate(countRawState(awaySamples, "looking"), awaySamples.length),
    falseAwayCount: countRawState(screenSamples, "away"),
    falseAwayDenominator: screenSamples.length,
    falseAwayRate: rate(countRawState(screenSamples, "away"), screenSamples.length),
    labels: Object.fromEntries(
      EVALUATION_LABELS.map((label) => [label, analyzeLabel(samples, label)])
    )
  };
}

export function formatEvaluationAnalysis(analysis) {
  const lines = [
    "Evaluation export analysis",
    `Files: ${analysis.fileCount}`,
    `Total samples: ${analysis.totalSamples}`,
    `False-looking rate: ${formatPercent(analysis.falseLookingRate)} (${analysis.falseLookingCount}/${analysis.falseLookingDenominator} away-label samples)`,
    `False-away rate: ${formatPercent(analysis.falseAwayRate)} (${analysis.falseAwayCount}/${analysis.falseAwayDenominator} screen-label samples)`,
    "",
    "Per-label rows:",
    table([
      [
        "Label",
        "Count",
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
          label,
          row.count.toString(),
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
  const labelSamples = samples.filter((sample) => sample.label === label);

  return {
    count: labelSamples.length,
    lookingPercent: statePercent(labelSamples, "looking"),
    unknownPercent: statePercent(labelSamples, "unknown"),
    awayPercent: statePercent(labelSamples, "away"),
    faceMissingPercent: statePercent(labelSamples, "face-missing"),
    medianTrackingScore: median(labelSamples.map((sample) => sample.trackingScore)),
    medianKeyboardScore: median(labelSamples.map((sample) => sample.keyboardScore))
  };
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
