import type { CameraStatus } from "../hooks/useCamera";
import type { FaceTrackerStatus } from "../tracking/faceTracker";

type SetupScreenProps = {
  cameraStatus: CameraStatus;
  trackerStatus: FaceTrackerStatus;
  errorMessage: string | null;
  hasFace: boolean;
  onRequestCamera: () => void;
  onStartCalibration: () => void;
};

const CAMERA_LABELS: Record<CameraStatus, string> = {
  idle: "Camera not started",
  requesting: "Requesting camera",
  ready: "Camera ready",
  denied: "Camera blocked",
  unavailable: "No camera found",
  error: "Camera error"
};

const TRACKER_LABELS: Record<FaceTrackerStatus, string> = {
  idle: "Tracker waiting",
  loading: "Loading tracker",
  ready: "Tracker ready",
  error: "Tracker error"
};

export function SetupScreen({
  cameraStatus,
  trackerStatus,
  errorMessage,
  hasFace,
  onRequestCamera,
  onStartCalibration
}: SetupScreenProps) {
  const canRequestCamera =
    cameraStatus === "idle" ||
    cameraStatus === "denied" ||
    cameraStatus === "unavailable" ||
    cameraStatus === "error";
  const canStartCalibration =
    cameraStatus === "ready" && trackerStatus === "ready" && hasFace;

  return (
    <main className="app-shell setup-shell">
      <section className="setup-panel" aria-labelledby="setup-title">
        <p className="eyebrow">Local webcam attention tracker</p>
        <h1 id="setup-title">Calibrate before testing</h1>
        <p className="lede">
          Use your webcam locally to learn what looking at the screen looks like, then run a
          simple green/red attention test.
        </p>

        <div className="status-grid" aria-label="Readiness status">
          <StatusItem
            label="Camera"
            value={CAMERA_LABELS[cameraStatus]}
            ready={cameraStatus === "ready"}
          />
          <StatusItem
            label="Tracker"
            value={TRACKER_LABELS[trackerStatus]}
            ready={trackerStatus === "ready"}
          />
          <StatusItem
            label="Face"
            value={hasFace ? "Face detected" : "Waiting for face"}
            ready={hasFace}
          />
        </div>

        {errorMessage ? (
          <p className="error-message" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="actions">
          {canRequestCamera ? (
            <button className="primary-button" type="button" onClick={onRequestCamera}>
              Enable camera
            </button>
          ) : (
            <button
              className="primary-button"
              type="button"
              onClick={onStartCalibration}
              disabled={!canStartCalibration}
            >
              Start calibration
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function StatusItem({
  label,
  value,
  ready
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="status-item">
      <span className={ready ? "status-dot status-dot--ready" : "status-dot"} aria-hidden="true" />
      <div>
        <p className="status-label">{label}</p>
        <p className="status-value">{value}</p>
      </div>
    </div>
  );
}
