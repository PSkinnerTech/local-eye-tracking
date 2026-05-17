import type { AttentionResult, RawAttentionState } from "../domain/types";
import type { DisplayAttentionState, SmootherSnapshot } from "../domain/smoothing";

type TestDisplayState = DisplayAttentionState | RawAttentionState;

type TestScreenProps = {
  displayState: TestDisplayState;
  attention: AttentionResult | null;
  smoother: SmootherSnapshot | null;
  onRecalibrate: () => void;
};

export function TestScreen({
  displayState,
  attention,
  smoother,
  onRecalibrate
}: TestScreenProps) {
  const rawState =
    smoother?.rawState ??
    attention?.rawState ??
    (displayState === "green" || displayState === "red" ? "unknown" : displayState);
  const statusLabel = statusFor(rawState);
  const confidence =
    attention && attention.rawState !== "face-missing" && Number.isFinite(attention.confidence)
      ? `${Math.round(attention.confidence * 100)}% confidence`
      : "Waiting for face";
  const isRed =
    displayState === "red" || displayState === "away" || displayState === "face-missing";

  return (
    <main className={isRed ? "test-shell test-shell--red" : "test-shell test-shell--green"}>
      <button className="test-recalibrate" type="button" onClick={onRecalibrate}>
        Recalibrate
      </button>
      <section className="test-readout" aria-live="polite">
        <p className="test-status">{statusLabel}</p>
        <p className="test-confidence">{confidence}</p>
      </section>
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
