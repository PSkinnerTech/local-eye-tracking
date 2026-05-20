import type { FrameFeatures } from "./types";

export type NormalizedLandmark = {
  x: number;
  y: number;
  z?: number;
};

export type FaceFrameOutputs = {
  blendshapes?: {
    categories?: {
      categoryName?: string;
      score?: number;
    }[];
  };
  facialTransformationMatrix?: {
    rows?: number;
    columns?: number;
    data?: ArrayLike<number>;
    getAsFloat32Array?: () => ArrayLike<number>;
  };
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
const MATRIX_SIZE = 4;
const EULER_EPSILON = 0.000001;

const BLENDSHAPE_DIAGNOSTICS = [
  "eyeLookDownLeft",
  "eyeLookDownRight",
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "eyeLookInLeft",
  "eyeLookInRight",
  "eyeLookOutLeft",
  "eyeLookOutRight"
] as const;

export function extractFrameFeatures(
  landmarks: NormalizedLandmark[],
  timestampMs: number,
  outputs?: FaceFrameOutputs
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
  const landmarkPitch = (nose.y - eyeCenterY) / faceHeightFromEyes;
  const landmarkYaw = (nose.x - (leftFace.x + rightFace.x) / 2) / faceWidth;
  const matrixPose = extractMatrixPose(outputs?.facialTransformationMatrix);

  return {
    timestampMs,
    faceDetected: true,
    pitch: matrixPose?.pitch ?? landmarkPitch,
    yaw: matrixPose?.yaw ?? landmarkYaw,
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
    faceScale: Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY),
    ...(matrixPose
      ? {
          matrixPitch: matrixPose.pitch,
          matrixYaw: matrixPose.yaw,
          matrixRoll: matrixPose.roll
        }
      : {}),
    ...extractBlendshapeDiagnostics(outputs?.blendshapes)
  };
}

function extractBlendshapeDiagnostics(
  blendshapes: FaceFrameOutputs["blendshapes"] | undefined
) {
  if (!blendshapes?.categories) {
    return {};
  }

  const scores = new Map<string, number>();
  for (const category of blendshapes.categories) {
    if (
      category.categoryName &&
      category.score !== undefined &&
      Number.isFinite(category.score)
    ) {
      scores.set(category.categoryName, category.score);
    }
  }

  const diagnostics: Partial<Pick<FrameFeatures, (typeof BLENDSHAPE_DIAGNOSTICS)[number]>> = {};
  for (const key of BLENDSHAPE_DIAGNOSTICS) {
    const score = scores.get(key);
    if (score !== undefined) {
      diagnostics[key] = score;
    }
  }

  return diagnostics;
}

function extractMatrixPose(
  matrix: FaceFrameOutputs["facialTransformationMatrix"] | undefined
) {
  const data = matrixData(matrix);
  if (!data) {
    return null;
  }

  const r00 = data[0];
  const r10 = data[4];
  const r20 = data[8];
  const r21 = data[9];
  const r22 = data[10];
  const sinYaw = -r20;

  if (sinYaw < -1 - EULER_EPSILON || sinYaw > 1 + EULER_EPSILON) {
    return null;
  }

  const pitch = Math.atan2(r21, r22);
  const yaw = Math.asin(clamp(sinYaw, -1, 1));
  const roll = Math.atan2(r10, r00);

  if (![pitch, yaw, roll].every(Number.isFinite)) {
    return null;
  }

  return { pitch, yaw, roll };
}

function matrixData(
  matrix: FaceFrameOutputs["facialTransformationMatrix"] | undefined
): number[] | null {
  if (!matrix) {
    return null;
  }

  if (
    (matrix.rows !== undefined && matrix.rows !== MATRIX_SIZE) ||
    (matrix.columns !== undefined && matrix.columns !== MATRIX_SIZE)
  ) {
    return null;
  }

  let data = matrix.data;
  if (!data && matrix.getAsFloat32Array) {
    try {
      data = matrix.getAsFloat32Array();
    } catch {
      return null;
    }
  }

  if (!data || data.length < MATRIX_SIZE * MATRIX_SIZE) {
    return null;
  }

  const values = Array.from(data).slice(0, MATRIX_SIZE * MATRIX_SIZE);
  if (!values.every(Number.isFinite)) {
    return null;
  }

  return values;
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
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isFinitePoint(landmark: NormalizedLandmark | undefined): landmark is NormalizedLandmark {
  return Boolean(landmark && Number.isFinite(landmark.x) && Number.isFinite(landmark.y));
}
