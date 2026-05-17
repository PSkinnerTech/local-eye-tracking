import { describe, expect, it } from "vitest";
import {
  buildCalibrationProfile,
  CALIBRATION_POINTS,
  hasEnoughSamplesForPoint
} from "./calibration";
import type { CalibrationBuildResult } from "./calibration";
import type { CalibrationPointId, FrameFeatures } from "./types";

function sample(point: CalibrationPointId, offset: number): FrameFeatures {
  return {
    timestampMs: 1000 + offset,
    faceDetected: true,
    point,
    pitch: 0.42 + offset * 0.001,
    yaw: 0.05 + offset * 0.001,
    eyeVertical: 0.5 + offset * 0.001,
    eyeHorizontal: 0.5,
    faceCenterX: 0.5,
    faceCenterY: 0.45,
    faceScale: 0.62
  };
}

function samplesByPoint(
  sampleFactory: (point: CalibrationPointId, index: number) => FrameFeatures
) {
  return Object.fromEntries(
    CALIBRATION_POINTS.map((point) => [
      point.id,
      Array.from({ length: 14 }, (_, index) => sampleFactory(point.id, index))
    ])
  );
}

describe("calibration", () => {
  it("defines the five calibration points in screen order", () => {
    expect(CALIBRATION_POINTS.map((point) => point.id)).toEqual([
      "top-left",
      "top-right",
      "bottom-right",
      "bottom-left",
      "center"
    ]);
  });

  it("rejects calibration points with too few valid samples", () => {
    expect(hasEnoughSamplesForPoint([sample("center", 1)], 12)).toBe(false);
    expect(
      hasEnoughSamplesForPoint(
        Array.from({ length: 12 }, (_, index) => sample("center", index)),
        12
      )
    ).toBe(true);
  });

  it("builds a profile with medians and tolerances from every point", () => {
    const calibrationSamples = samplesByPoint(sample);

    const result: CalibrationBuildResult =
      buildCalibrationProfile(calibrationSamples);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.points).toHaveLength(5);
    expect(result.profile.center.pitch).toBeCloseTo(0.4265, 4);
    expect(result.profile.tolerance.pitch).toBe(0.04);
    expect(result.profile.tolerance.faceScale).toBe(0.06);
  });

  it("uses percentile tolerance when it exceeds the feature floor", () => {
    const calibrationSamples = samplesByPoint((point, index) => ({
      ...sample(point, index),
      pitch: index * 0.1
    }));

    const result = buildCalibrationProfile(calibrationSamples);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.tolerance.pitch).toBeGreaterThan(0.04);
    expect(result.profile.tolerance.pitch).toBeCloseTo(1.17, 2);
  });

  it("reports the point that needs retry when samples are insufficient", () => {
    const samplesByPoint = Object.fromEntries(
      CALIBRATION_POINTS.map((point) => [
        point.id,
        point.id === "bottom-left"
          ? Array.from({ length: 3 }, (_, index) => sample(point.id, index))
          : Array.from({ length: 14 }, (_, index) => sample(point.id, index))
      ])
    );

    const result = buildCalibrationProfile(samplesByPoint);

    expect(result).toEqual({
      ok: false,
      reason: "insufficient-samples",
      pointId: "bottom-left"
    });
  });

  it("rejects samples with non-finite feature values", () => {
    const samples = Array.from({ length: 12 }, (_, index) => ({
      ...sample("center", index),
      pitch: index === 0 ? Number.NaN : 0.42
    }));

    expect(hasEnoughSamplesForPoint(samples, 12)).toBe(false);
  });

  it("reports insufficient samples instead of returning a NaN profile", () => {
    const calibrationSamples = samplesByPoint((point, index) => ({
      ...sample(point, index),
      yaw: point === "top-left" ? Number.POSITIVE_INFINITY : 0.05
    }));

    const result = buildCalibrationProfile(calibrationSamples);

    expect(result).toEqual({
      ok: false,
      reason: "insufficient-samples",
      pointId: "top-left"
    });
  });
});
