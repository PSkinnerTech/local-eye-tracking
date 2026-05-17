import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark as MediaPipeLandmark } from "@mediapipe/tasks-vision";
import packageJson from "../../package.json";
import { extractFrameFeatures } from "../domain/landmarks";
import type { FrameFeatures } from "../domain/types";

export type FaceTrackerStatus = "idle" | "loading" | "ready" | "error";

export type FaceTracker = {
  detect(video: HTMLVideoElement, timestampMs: number): FrameFeatures | null;
  dispose(): void;
};

const TASKS_VISION_VERSION = packageJson.dependencies["@mediapipe/tasks-vision"];

export const WASM_URL =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;

// Startup fetches MediaPipe model assets only; video frames stay local in the browser.
export const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

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
