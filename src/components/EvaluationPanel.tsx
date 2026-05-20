import { useState } from "react";
import {
  EVALUATION_LABEL_METADATA,
  EVALUATION_LABELS,
  type EvaluationLabel,
  type EvaluationSample,
  type EvaluationSummary
} from "../domain/evaluation";

type EvaluationPanelProps = {
  samples: EvaluationSample[];
  summary: EvaluationSummary;
  disabledReason?: string;
  onCapture: (label: EvaluationLabel) => void;
  onClear: () => void;
  onExport: () => void;
};

export function EvaluationPanel({
  samples,
  summary,
  disabledReason,
  onCapture,
  onClear,
  onExport
}: EvaluationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasSamples = samples.length > 0;
  const captureDisabled = Boolean(disabledReason);
  const targetSamples = summary.targetSamples ?? totalTargetSamples();
  const progressSamples = summary.balancedSampleCount ?? Math.min(summary.totalSamples, targetSamples);
  const missingLabels = EVALUATION_LABELS.filter(
    (label) => (summary.labels[label].remainingCount ?? 0) > 0
  );

  return (
    <aside className="evaluation-panel" aria-label="Evaluation capture">
      <button
        className="evaluation-toggle"
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        Evaluate
      </button>

      {isOpen ? (
        <div className="evaluation-body">
          <div className="evaluation-summary" aria-label="Evaluation summary">
            <span>
              Progress {progressSamples}/{targetSamples}
            </span>
            <span>False-looking {formatPercent(summary.falseLookingRate)}</span>
            <span>False-away {formatPercent(summary.falseAwayRate)}</span>
            {summary.extraSamples ? <span>Extra {summary.extraSamples}</span> : null}
          </div>

          {disabledReason ? <p className="evaluation-warning">{disabledReason}</p> : null}

          <div className="evaluation-label-grid" aria-label="Capture label">
            {EVALUATION_LABELS.map((label) => {
              const isComplete = isLabelComplete(summary, label);

              return (
                <button
                  key={label}
                  type="button"
                  disabled={captureDisabled || isComplete}
                  title={
                    isComplete
                      ? `${labelDisplayName(summary, label)} complete`
                      : EVALUATION_LABEL_METADATA[label].instruction
                  }
                  onClick={() => onCapture(label)}
                >
                  {labelDisplayName(summary, label)}
                </button>
              );
            })}
          </div>

          {missingLabels.length > 0 ? (
            <p className="evaluation-missing">
              Missing{" "}
              {missingLabels
                .map((label) => {
                  const labelSummary = summary.labels[label];

                  return `${labelDisplayName(summary, label)} ${labelSummary.remainingCount ?? 0}`;
                })
                .join(", ")}
            </p>
          ) : (
            <p className="evaluation-missing">Baseline complete</p>
          )}

          <div className="evaluation-counts" aria-label="Evaluation counts">
            {EVALUATION_LABELS.map((label) => {
              const labelSummary = summary.labels[label];
              const metadata = EVALUATION_LABEL_METADATA[label];
              const displayName = labelSummary.displayName ?? metadata.displayName;
              const targetCount = labelSummary.targetCount ?? metadata.targetCount;
              const isComplete = labelSummary.isComplete ?? labelSummary.sampleCount >= targetCount;

              return (
                <span key={label}>
                  {displayName} {labelSummary.sampleCount}/{targetCount}
                  {isComplete ? " Done" : ""}
                </span>
              );
            })}
          </div>

          <div className="evaluation-actions">
            <button type="button" disabled={!hasSamples} onClick={onExport}>
              Export JSON
            </button>
            <button type="button" disabled={!hasSamples} onClick={onClear}>
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function labelDisplayName(summary: EvaluationSummary, label: EvaluationLabel): string {
  return summary.labels[label].displayName ?? EVALUATION_LABEL_METADATA[label].displayName;
}

function isLabelComplete(summary: EvaluationSummary, label: EvaluationLabel): boolean {
  const labelSummary = summary.labels[label];
  const targetCount = labelSummary.targetCount ?? EVALUATION_LABEL_METADATA[label].targetCount;

  return labelSummary.isComplete ?? labelSummary.sampleCount >= targetCount;
}

function totalTargetSamples(): number {
  return EVALUATION_LABELS.reduce(
    (total, label) => total + EVALUATION_LABEL_METADATA[label].targetCount,
    0
  );
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return `${Math.round(value * 100)}%`;
}
