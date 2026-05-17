import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "denied"
  | "unavailable"
  | "error";

export type CameraState = {
  status: CameraStatus;
  stream: MediaStream | null;
  errorMessage: string | null;
};

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: "user",
    width: { ideal: 960 },
    height: { ideal: 540 }
  },
  audio: false
};

const INITIAL_STATE: CameraState = {
  status: "idle",
  stream: null,
  errorMessage: null
};

export function useCamera() {
  const [state, setState] = useState<CameraState>(INITIAL_STATE);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback((stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => {
      track.stop();
    });
  }, []);

  const stop = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setState(INITIAL_STATE);
  }, [stopStream]);

  const request = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      streamRef.current = null;
      setState({
        status: "unavailable",
        stream: null,
        errorMessage: "No usable webcam was found."
      });
      return;
    }

    setState({
      status: "requesting",
      stream: null,
      errorMessage: null
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      stopStream(streamRef.current);
      streamRef.current = stream;
      setState({
        status: "ready",
        stream,
        errorMessage: null
      });
    } catch (error) {
      streamRef.current = null;
      setState({
        ...cameraErrorState(error),
        stream: null
      });
    }
  }, [stopStream]);

  useEffect(() => stop, [stop]);

  return {
    ...state,
    request,
    stop
  };
}

function cameraErrorState(error: unknown): Pick<CameraState, "status" | "errorMessage"> {
  const errorName = error instanceof DOMException ? error.name : undefined;

  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    return {
      status: "denied",
      errorMessage: "Camera access is required for local attention tracking."
    };
  }

  if (errorName === "NotFoundError" || errorName === "OverconstrainedError") {
    return {
      status: "unavailable",
      errorMessage: "No usable webcam was found."
    };
  }

  return {
    status: "error",
    errorMessage: "The camera could not be started."
  };
}
