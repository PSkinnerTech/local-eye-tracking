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
    detectForVideo.mockReturnValue({
      faceLandmarks: [[{ x: 0.5, y: 0.25 }]],
      faceBlendshapes: [],
      facialTransformationMatrixes: []
    });
    extractFrameFeatures.mockReturnValue({ faceDetected: true });
  });

  it("loads MediaPipe FaceLandmarker and extracts features from the first detected face", async () => {
    const { createFaceTracker, MODEL_URL, WASM_URL } = await import("./faceTracker");
    const tracker = await createFaceTracker();
    const video = document.createElement("video");
    const blendshapes = {
      categories: [{ categoryName: "eyeBlinkLeft", score: 0.42 }]
    };
    const facialTransformationMatrix = {
      rows: 4,
      columns: 4,
      data: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    };

    detectForVideo.mockReturnValue({
      faceLandmarks: [[{ x: 0.5, y: 0.25 }]],
      faceBlendshapes: [blendshapes],
      facialTransformationMatrixes: [facialTransformationMatrix]
    });

    expect(WASM_URL).toBe("/wasm");
    expect(WASM_URL).not.toMatch(/^https?:\/\//);
    expect(WASM_URL).not.toContain("@latest");
    expect(MODEL_URL).toBe("/models/face_landmarker.task");
    expect(MODEL_URL).not.toMatch(/^https?:\/\//);
    expect(MODEL_URL).not.toContain("/latest/");
    expect(forVisionTasks).toHaveBeenCalledWith(WASM_URL);
    expect(createFromOptions).toHaveBeenCalledWith(
      "vision",
      expect.objectContaining({
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "CPU"
        },
        canvas: expect.any(HTMLCanvasElement),
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true
      })
    );
    expect(tracker.detect(video, 123)).toEqual({ faceDetected: true });
    expect(detectForVideo).toHaveBeenCalledWith(video, 123);
    expect(extractFrameFeatures).toHaveBeenCalledWith([{ x: 0.5, y: 0.25 }], 123, {
      blendshapes,
      facialTransformationMatrix
    });

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
