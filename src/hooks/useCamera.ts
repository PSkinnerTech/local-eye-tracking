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
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);

  const stopStream = useCallback((stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => {
      track.stop();
    });
  }, []);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    stopStream(streamRef.current);
    streamRef.current = null;
    if (mountedRef.current) {
      setState(INITIAL_STATE);
    }
  }, [stopStream]);

  const request = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!navigator.mediaDevices?.getUserMedia) {
      if (mountedRef.current) {
        setState({
          status: "unavailable",
          stream: streamRef.current,
          errorMessage: "No usable webcam was found."
        });
      }
      return;
    }

    if (mountedRef.current) {
      setState({
        status: "requesting",
        stream: streamRef.current,
        errorMessage: null
      });
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        stopStream(stream);
        return;
      }

      const previousStream = streamRef.current;
      if (previousStream !== stream) {
        stopStream(previousStream);
      }

      streamRef.current = stream;
      setState({
        status: "ready",
        stream,
        errorMessage: null
      });
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setState({
        ...cameraErrorState(error),
        stream: streamRef.current
      });
    }
  }, [stopStream]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [stopStream]);

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
