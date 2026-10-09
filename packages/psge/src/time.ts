/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
/** Default max simulation step in seconds (prevents huge pauses). */
export const DEFAULT_MAX_DELTA = 1 / 20;

/**
 * Clamp a frame delta so a long tab pause cannot produce one enormous step.
 */
export function clampDelta(
  deltaSeconds: number,
  maxDeltaSeconds: number = DEFAULT_MAX_DELTA,
): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    return 0;
  }
  return Math.min(deltaSeconds, maxDeltaSeconds);
}
