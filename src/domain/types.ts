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
  | "faceCenterX"
  | "faceCenterY"
  | "faceScale";

export const FEATURE_KEYS: FeatureKey[] = [
  "pitch",
  "yaw",
  "eyeVertical",
  "eyeHorizontal",
  "faceCenterX",
  "faceCenterY",
  "faceScale"
];

export type FrameFeatures = Record<FeatureKey, number> & {
  timestampMs: number;
  faceDetected: boolean;
  point?: CalibrationPointId;
};

export type FeatureVector = Record<FeatureKey, number>;

export type CalibrationPoint = {
  id: CalibrationPointId;
  label: string;
  xPercent: number;
  yPercent: number;
};

export type CalibrationProfile = {
  createdAtMs: number;
  minValidSamplesPerPoint: number;
  points: CalibrationPointId[];
  center: FeatureVector;
  tolerance: FeatureVector;
  keyboardCenter?: FeatureVector;
  keyboardTolerance?: FeatureVector;
};

export type RawAttentionState = "looking" | "away" | "unknown" | "face-missing";

export type AttentionResult = {
  rawState: RawAttentionState;
  confidence: number;
  distance: number;
  trackingScore: number;
};
