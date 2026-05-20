import type { FrameFeatures } from "./types";

export type NormalizedLandmark = {
  x: number;
  y: number;
  z?: number;
};

export const LANDMARK = {
  noseTip: 1,
  chin: 152,
  leftFace: 234,
  rightFace: 454,
  leftEyeOuter: 33,
  leftEyeInner: 133,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  rightEyeInner: 362,
  rightEyeOuter: 263,
  rightEyeTop: 386,
  rightEyeBottom: 374,
  leftIrisCenter: 468,
  rightIrisCenter: 473
} as const;

const REQUIRED_LANDMARKS = Object.values(LANDMARK);
const MIN_DENOMINATOR = 0.0001;

export function extractFrameFeatures(
  landmarks: NormalizedLandmark[],
  timestampMs: number
): FrameFeatures | null {
  if (!hasRequiredLandmarks(landmarks)) {
    return null;
  }

  const bounds = boundingBox(landmarks);
  if (!bounds) {
    return null;
  }

  const nose = landmarks[LANDMARK.noseTip];
  const chin = landmarks[LANDMARK.chin];
  const leftFace = landmarks[LANDMARK.leftFace];
  const rightFace = landmarks[LANDMARK.rightFace];
  const leftEyeTop = landmarks[LANDMARK.leftEyeTop];
  const leftEyeBottom = landmarks[LANDMARK.leftEyeBottom];
  const leftEyeOuter = landmarks[LANDMARK.leftEyeOuter];
  const leftEyeInner = landmarks[LANDMARK.leftEyeInner];
  const rightEyeTop = landmarks[LANDMARK.rightEyeTop];
  const rightEyeBottom = landmarks[LANDMARK.rightEyeBottom];
  const rightEyeInner = landmarks[LANDMARK.rightEyeInner];
  const rightEyeOuter = landmarks[LANDMARK.rightEyeOuter];
  const leftIris = landmarks[LANDMARK.leftIrisCenter];
  const rightIris = landmarks[LANDMARK.rightIrisCenter];

  const eyeCenterY =
    (leftEyeOuter.y + leftEyeInner.y + rightEyeInner.y + rightEyeOuter.y) / 4;
  const faceWidth = Math.max(rightFace.x - leftFace.x, MIN_DENOMINATOR);
  const faceHeightFromEyes = Math.max(chin.y - eyeCenterY, MIN_DENOMINATOR);

  const leftEyeVertical = ratio(leftIris.y, leftEyeTop.y, leftEyeBottom.y);
  const rightEyeVertical = ratio(rightIris.y, rightEyeTop.y, rightEyeBottom.y);
  const leftEyeHorizontal = ratio(leftIris.x, leftEyeOuter.x, leftEyeInner.x);
  const rightEyeHorizontal = ratio(rightIris.x, rightEyeInner.x, rightEyeOuter.x);
  const leftEyeOpenness = Math.abs(leftEyeBottom.y - leftEyeTop.y);
  const rightEyeOpenness = Math.abs(rightEyeBottom.y - rightEyeTop.y);

  return {
    timestampMs,
    faceDetected: true,
    pitch: (nose.y - eyeCenterY) / faceHeightFromEyes,
    yaw: (nose.x - (leftFace.x + rightFace.x) / 2) / faceWidth,
    eyeVertical: (leftEyeVertical + rightEyeVertical) / 2,
    eyeHorizontal: (leftEyeHorizontal + rightEyeHorizontal) / 2,
    leftEyeVertical,
    rightEyeVertical,
    leftEyeHorizontal,
    rightEyeHorizontal,
    leftEyeOpenness,
    rightEyeOpenness,
    faceCenterX: (bounds.minX + bounds.maxX) / 2,
    faceCenterY: (bounds.minY + bounds.maxY) / 2,
    faceScale: Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
  };
}

function hasRequiredLandmarks(landmarks: NormalizedLandmark[]): boolean {
  return REQUIRED_LANDMARKS.every((index) => isFinitePoint(landmarks[index]));
}

function boundingBox(landmarks: NormalizedLandmark[]) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const landmark of landmarks) {
    if (!isFinitePoint(landmark)) {
      continue;
    }

    minX = Math.min(minX, landmark.x);
    minY = Math.min(minY, landmark.y);
    maxX = Math.max(maxX, landmark.x);
    maxY = Math.max(maxY, landmark.y);
  }

  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function ratio(value: number, start: number, end: number): number {
  return clamp01((value - start) / Math.max(end - start, MIN_DENOMINATOR));
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function isFinitePoint(landmark: NormalizedLandmark | undefined): landmark is NormalizedLandmark {
  return Boolean(landmark && Number.isFinite(landmark.x) && Number.isFinite(landmark.y));
}
