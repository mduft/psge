/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */

export const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 1000;
export const DEFAULT_AUTOSAVE_MAX_INTERVAL_MS = 30_000;

export interface AutosavePolicyInput {
  now: number;
  /** Time of the latest state change that marked the save dirty. */
  lastChangeAt: number;
  /** When the current dirty streak began (first change after last successful save). */
  dirtySince: number;
  debounceMs?: number;
  maxIntervalMs?: number;
}

export type AutosaveDecision = "wait" | "debounce-ready" | "max-interval";

/**
 * Pure policy for debounce + max-while-dirty autosave.
 * Caller still owns timers; use this to decide whether a tick should save.
 */
export function decideAutosave(input: AutosavePolicyInput): AutosaveDecision {
  const debounceMs = input.debounceMs ?? DEFAULT_AUTOSAVE_DEBOUNCE_MS;
  const maxIntervalMs = input.maxIntervalMs ?? DEFAULT_AUTOSAVE_MAX_INTERVAL_MS;
  if (input.now - input.dirtySince >= maxIntervalMs) {
    return "max-interval";
  }
  if (input.now - input.lastChangeAt >= debounceMs) {
    return "debounce-ready";
  }
  return "wait";
}
