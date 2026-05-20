import { useState } from "react";
import {
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

const LABEL_TEXT: Record<EvaluationLabel, string> = {
  "screen-center": "Screen center",
  "screen-bottom": "Screen bottom",
  keyboard: "Keyboard",
  "off-left": "Off left",
  "off-right": "Off right",
  "lean-left": "Lean left",
  "lean-right": "Lean right",
  "low-light": "Low light"
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
            <span>Samples {summary.totalSamples}</span>
            <span>False-looking {formatPercent(summary.falseLookingRate)}</span>
            <span>False-away {formatPercent(summary.falseAwayRate)}</span>
          </div>

          {disabledReason ? <p className="evaluation-warning">{disabledReason}</p> : null}

          <div className="evaluation-label-grid" aria-label="Capture label">
            {EVALUATION_LABELS.map((label) => (
              <button
                key={label}
                type="button"
                disabled={captureDisabled}
                onClick={() => onCapture(label)}
              >
                {LABEL_TEXT[label]}
              </button>
            ))}
          </div>

          <div className="evaluation-counts" aria-label="Evaluation counts">
            {EVALUATION_LABELS.map((label) => (
              <span key={label}>
                {LABEL_TEXT[label]} {summary.labels[label].sampleCount}
              </span>
            ))}
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

function formatPercent(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return `${Math.round(value * 100)}%`;
}
