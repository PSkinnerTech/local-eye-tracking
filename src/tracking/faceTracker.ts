import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark as MediaPipeLandmark } from "@mediapipe/tasks-vision";
import { extractFrameFeatures } from "../domain/landmarks";
import type { FrameFeatures } from "../domain/types";

export type FaceTrackerStatus = "idle" | "loading" | "ready" | "error";

export type FaceTracker = {
  detect(video: HTMLVideoElement, timestampMs: number): FrameFeatures | null;
  dispose(): void;
};

// The app serves MediaPipe runtime/model assets locally; video frames stay in-browser.
export const WASM_URL = "/wasm";
export const MODEL_URL = "/models/face_landmarker.task";

export async function createFaceTracker(): Promise<FaceTracker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numFaces: 1
  });

  return {
    detect(video: HTMLVideoElement, timestampMs: number) {
      const result = landmarker.detectForVideo(video, timestampMs);
      const landmarks = result.faceLandmarks[0];

      if (!landmarks) {
        return null;
      }

      return extractFrameFeatures(landmarks.map(toDomainLandmark), timestampMs);
    },
    dispose() {
      landmarker.close();
    }
  };
}

function toDomainLandmark(landmark: MediaPipeLandmark) {
  return {
    x: landmark.x,
    y: landmark.y,
    z: landmark.z
  };
}
