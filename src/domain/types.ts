export type CalibrationPointId =
  | "top-left"
  | "top-right"
  | "bottom-right"
  | "bottom-left"
  | "center"
  | "keyboard";

export type FeatureKey =
  | "pitch"
  | "yaw"
  | "eyeVertical"
  | "eyeHorizontal"
  | "leftEyeVertical"
  | "rightEyeVertical"
  | "leftEyeHorizontal"
  | "rightEyeHorizontal"
  | "leftEyeOpenness"
  | "rightEyeOpenness"
  | "faceCenterX"
  | "faceCenterY"
  | "faceScale";

export const FEATURE_KEYS: FeatureKey[] = [
  "pitch",
  "yaw",
  "eyeVertical",
  "eyeHorizontal",
  "leftEyeVertical",
  "rightEyeVertical",
  "leftEyeHorizontal",
  "rightEyeHorizontal",
  "leftEyeOpenness",
  "rightEyeOpenness",
  "faceCenterX",
  "faceCenterY",
  "faceScale"
];

export type FrameFeatures = Record<FeatureKey, number> & {
  timestampMs: number;
  faceDetected: boolean;
  point?: CalibrationPointId;
  matrixPitch?: number;
  matrixYaw?: number;
  matrixRoll?: number;
  eyeLookDownLeft?: number;
  eyeLookDownRight?: number;
  eyeBlinkLeft?: number;
  eyeBlinkRight?: number;
  eyeLookInLeft?: number;
  eyeLookInRight?: number;
  eyeLookOutLeft?: number;
  eyeLookOutRight?: number;
};

export type FeatureVector = Record<FeatureKey, number>;

export type LearnedAttentionClass = "screen" | "keyboard";

export type LearnedAttentionModel = {
  version: 1;
  featureKeys: FeatureKey[];
  screenCenter: FeatureVector;
  keyboardCenter: FeatureVector;
  scale: FeatureVector;
  screenRadius: number;
  keyboardRadius: number;
  keyboardSeparation: number;
};

export type CalibrationPoint = {
  id: CalibrationPointId;
  label: string;
  xPercent: number;
  yPercent: number;
};

export type KeyboardCalibrationQuality = "weak" | "usable" | "strong";

export type CalibrationProfile = {
  createdAtMs: number;
  minValidSamplesPerPoint: number;
  points: CalibrationPointId[];
  center: FeatureVector;
  tolerance: FeatureVector;
  keyboardCenter?: FeatureVector;
  keyboardTolerance?: FeatureVector;
  keyboardSeparation?: number;
  keyboardQuality?: KeyboardCalibrationQuality;
};

export type RawAttentionState = "looking" | "away" | "unknown" | "face-missing";

export type AttentionResult = {
  rawState: RawAttentionState;
  confidence: number;
  distance: number;
  trackingScore: number;
  screenDistance?: number;
  sideGazeScore?: number;
  sideGazeDirection?: "left" | "right";
  keyboardDistance?: number;
  keyboardScore?: number;
  keyboardSeparation?: number;
  keyboardQuality?: KeyboardCalibrationQuality;
};
