import type { VitalKey, VitalStatus } from "./types";

export interface VitalThreshold {
  greenMin: number;
  yellowMin: number;
}

/**
 * Initial calibration thresholds.
 *
 * Pulse: monthly job posting volume. Healthy sectors show sustained demand.
 * Oxygen: role-title variety plus new-job-title weak signals. Diversity means more ways to enter.
 * Temperature: news and growth-library attention. Moderate attention is healthy; low attention is cold.
 * Pressure: role competition proxy from role-title spread because employer/company is not stored.
 * Adrenaline: emerging weak signal strength. Higher values mean more near-future movement.
 *
 * Decision: recalibrate after two weeks of telemetry and real sector distributions.
 */
export const VITAL_THRESHOLDS: Record<VitalKey, VitalThreshold> = {
  pulse: { greenMin: 120, yellowMin: 40 },
  oxygen: { greenMin: 12, yellowMin: 5 },
  temperature: { greenMin: 8, yellowMin: 2 },
  pressure: { greenMin: 10, yellowMin: 4 },
  adrenaline: { greenMin: 60, yellowMin: 25 },
};

export function statusForValue(key: VitalKey, value: number): VitalStatus {
  const threshold = VITAL_THRESHOLDS[key];
  if (value >= threshold.greenMin) return "green";
  if (value >= threshold.yellowMin) return "yellow";
  return "red";
}
