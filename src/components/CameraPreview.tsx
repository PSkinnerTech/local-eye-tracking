import { useEffect, useRef } from "react";

type CameraPreviewProps = {
  stream: MediaStream | null;
  onVideoReady: (video: HTMLVideoElement | null) => void;
  visible?: boolean;
};

export function CameraPreview({
  stream,
  onVideoReady,
  visible = false
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      onVideoReady(null);
      return;
    }

    video.srcObject = stream;
    onVideoReady(stream ? video : null);

    return () => {
      onVideoReady(null);
    };
  }, [onVideoReady, stream]);

  return (
    <video
      ref={videoRef}
      className={visible ? "camera-preview camera-preview-visible" : "camera-preview"}
      aria-label="Local webcam preview"
      muted
      autoPlay
      playsInline
    />
  );
}
