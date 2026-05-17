import { beforeEach, describe, expect, it, vi } from "vitest";

const detectForVideo = vi.fn();
const close = vi.fn();
const createFromOptions = vi.fn();
const forVisionTasks = vi.fn();
const extractFrameFeatures = vi.fn();

vi.mock("@mediapipe/tasks-vision", () => ({
  FaceLandmarker: { createFromOptions },
  FilesetResolver: { forVisionTasks }
}));

vi.mock("../domain/landmarks", () => ({
  extractFrameFeatures
}));

describe("createFaceTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forVisionTasks.mockResolvedValue("vision");
    createFromOptions.mockResolvedValue({ detectForVideo, close });
    detectForVideo.mockReturnValue({ faceLandmarks: [[{ x: 0.5, y: 0.25 }]] });
    extractFrameFeatures.mockReturnValue({ faceDetected: true });
  });

  it("loads MediaPipe FaceLandmarker and extracts features from the first detected face", async () => {
    const { createFaceTracker } = await import("./faceTracker");
    const tracker = await createFaceTracker();
    const video = document.createElement("video");

    expect(forVisionTasks).toHaveBeenCalledWith(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    expect(createFromOptions).toHaveBeenCalledWith("vision", {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numFaces: 1
    });
    expect(tracker.detect(video, 123)).toEqual({ faceDetected: true });
    expect(detectForVideo).toHaveBeenCalledWith(video, 123);
    expect(extractFrameFeatures).toHaveBeenCalledWith([{ x: 0.5, y: 0.25 }], 123);

    tracker.dispose();

    expect(close).toHaveBeenCalledOnce();
  });

  it("returns null when no face is detected", async () => {
    detectForVideo.mockReturnValue({ faceLandmarks: [] });
    const { createFaceTracker } = await import("./faceTracker");
    const tracker = await createFaceTracker();

    expect(tracker.detect(document.createElement("video"), 456)).toBeNull();
    expect(extractFrameFeatures).not.toHaveBeenCalled();
  });
});
