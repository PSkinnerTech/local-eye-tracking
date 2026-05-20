import type { AttentionResult, RawAttentionState } from "../domain/types";
import type { DisplayAttentionState, SmootherSnapshot } from "../domain/smoothing";
import type {
  EvaluationLabel,
  EvaluationSample,
  EvaluationSummary
} from "../domain/evaluation";
import { EvaluationPanel } from "./EvaluationPanel";

type TestDisplayState = DisplayAttentionState | RawAttentionState;

type EvaluationControls = {
  samples: EvaluationSample[];
  summary: EvaluationSummary;
  disabledReason?: string;
  onCapture: (label: EvaluationLabel) => void;
  onClear: () => void;
  onExport: () => void;
};

type TestScreenProps = {
  displayState: TestDisplayState;
  attention: AttentionResult | null;
  smoother: SmootherSnapshot | null;
  evaluation?: EvaluationControls;
  onRecalibrate: () => void;
};

export function TestScreen({
  displayState,
  attention,
  smoother,
  evaluation,
  onRecalibrate
}: TestScreenProps) {
  const rawState =
    smoother?.rawState ??
    attention?.rawState ??
    (displayState === "green" || displayState === "red" ? "unknown" : displayState);
  const statusLabel = statusFor(rawState);
  const confidence =
    attention && attention.rawState !== "face-missing" && Number.isFinite(attention.trackingScore)
      ? `${Math.round(attention.trackingScore * 100)}% tracking`
      : "Waiting for face";
  const isRed =
    displayState === "red" || displayState === "away" || displayState === "face-missing";
  const diagnostics = diagnosticsFor(attention);

  return (
    <main className={isRed ? "test-shell test-shell--red" : "test-shell test-shell--green"}>
      <button className="test-recalibrate" type="button" onClick={onRecalibrate}>
        Recalibrate
      </button>
      {evaluation ? <EvaluationPanel {...evaluation} /> : null}
      <section className="test-readout" aria-live="polite">
        <p className="test-status">{statusLabel}</p>
        <p className="test-confidence">{confidence}</p>
      </section>
      {diagnostics ? (
        <aside className="test-diagnostics" aria-label="Tracking diagnostics">
          <p className="test-diagnostics-quality">
            Calibration {diagnostics.keyboardQuality ?? "pending"}
          </p>
          <dl>
            {diagnostics.rows.map((row) => (
              <div key={row.label} className="test-diagnostics-row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      ) : null}
    </main>
  );
}

function statusFor(rawState: string): string {
  switch (rawState) {
    case "looking":
      return "Looking at screen";
    case "away":
      return "Looking away";
    case "face-missing":
      return "Face not detected";
    default:
      return "Checking";
  }
}

function diagnosticsFor(attention: AttentionResult | null) {
  if (!attention) {
    return null;
  }

  const rows = [
    metricRow("Screen distance", attention.screenDistance ?? attention.distance),
    sideGazeRow(attention),
    metricRow("Keyboard distance", attention.keyboardDistance),
    metricRow("Keyboard score", attention.keyboardScore),
    metricRow("Keyboard separation", attention.keyboardSeparation)
  ].filter((row): row is { label: string; value: string } => row !== null);

  if (rows.length === 0 && !attention.keyboardQuality) {
    return null;
  }

  return {
    keyboardQuality: attention.keyboardQuality,
    rows
  };
}

function metricRow(label: string, value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return {
    label,
    value: value.toFixed(2)
  };
}

function sideGazeRow(attention: AttentionResult) {
  if (
    typeof attention.sideGazeScore !== "number" ||
    !Number.isFinite(attention.sideGazeScore)
  ) {
    return null;
  }

  return {
    label: "Side gaze",
    value: `${attention.sideGazeScore.toFixed(2)} ${attention.sideGazeDirection ?? "side"}`
  };
}
