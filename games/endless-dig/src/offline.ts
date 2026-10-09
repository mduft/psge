/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Offline progression (M5): while away, auto-dig continues at a reduced rate.
 * Uses the same soft-capped passive rate as live play, then × efficiency × time.
 */
import Decimal from "decimal.js";
import {
  passiveRateOf,
  SHAFT_CROSS_SECTION,
  type GameState,
} from "./gameState.js";
import { softDigAmount } from "./softDig.js";

/** Max offline window credited. */
export const OFFLINE_MAX_MS = 24 * 60 * 60 * 1000;

/** Offline digs at this fraction of the live soft-capped auto rate. */
export const OFFLINE_EFFICIENCY = 1 / 6;

/**
 * Absences shorter than this are not "offline" (no claim modal / 1/6 rate).
 * Brief tab switches instead use full-rate catch-up via `computeHiddenCatchUp`.
 */
export const OFFLINE_MIN_MS = 30_000;

/** Ignore sub-second jitter when catching up a brief hide. */
export const HIDDEN_CATCHUP_MIN_MS = 250;

export interface OfflineReward {
  /** Credited duration after the 24h cap. */
  elapsedMs: number;
  /** Raw time since lastPlayedAt (may exceed the cap). */
  rawElapsedMs: number;
  depthGained: Decimal;
  dirtGained: Decimal;
  /** Soft-capped live auto rate (m/s) before efficiency. */
  softRatePerSec: number;
}

/**
 * Pure offline payout. Pass `nowMs` / `lastPlayedAtMs` for deterministic tests.
 * Returns null when there is nothing meaningful to claim.
 */
export function computeOfflineReward(
  state: GameState,
  lastPlayedAtMs: number,
  nowMs: number,
): OfflineReward | null {
  if (
    !Number.isFinite(lastPlayedAtMs) ||
    !Number.isFinite(nowMs) ||
    lastPlayedAtMs <= 0 ||
    nowMs < lastPlayedAtMs
  ) {
    return null;
  }
  const rawElapsedMs = nowMs - lastPlayedAtMs;
  if (rawElapsedMs < OFFLINE_MIN_MS) return null;

  const rate = passiveRateOf(state);
  if (rate.lte(0)) return null;

  const elapsedMs = Math.min(rawElapsedMs, OFFLINE_MAX_MS);
  const softRatePerSec = softDigAmount(rate.toNumber());
  if (!(softRatePerSec > 0)) return null;

  const depthGained = new Decimal(softRatePerSec)
    .mul(elapsedMs / 1000)
    .mul(OFFLINE_EFFICIENCY);
  if (depthGained.lte(0)) return null;

  return {
    elapsedMs,
    rawElapsedMs,
    depthGained,
    dirtGained: depthGained.mul(SHAFT_CROSS_SECTION),
    softRatePerSec,
  };
}

/** Apply a computed offline reward to state (mutates). */
export function claimOfflineReward(
  state: GameState,
  reward: OfflineReward,
): void {
  if (reward.depthGained.lte(0)) return;
  state.depth = state.depth.plus(reward.depthGained);
  state.dirt = state.dirt.plus(reward.dirtGained);
}

export interface HiddenCatchUp {
  elapsedMs: number;
  depthGained: Decimal;
  dirtGained: Decimal;
}

/**
 * Full soft-capped auto rate for brief background time (< offline threshold).
 * Used when the tab was hidden but not long enough to count as offline.
 */
export function computeHiddenCatchUp(
  state: GameState,
  lastPlayedAtMs: number,
  nowMs: number,
): HiddenCatchUp | null {
  if (
    !Number.isFinite(lastPlayedAtMs) ||
    !Number.isFinite(nowMs) ||
    lastPlayedAtMs <= 0 ||
    nowMs <= lastPlayedAtMs
  ) {
    return null;
  }
  const elapsedMs = nowMs - lastPlayedAtMs;
  if (elapsedMs < HIDDEN_CATCHUP_MIN_MS || elapsedMs >= OFFLINE_MIN_MS) {
    return null;
  }
  const rate = passiveRateOf(state);
  if (rate.lte(0)) return null;
  const softRatePerSec = softDigAmount(rate.toNumber());
  if (!(softRatePerSec > 0)) return null;
  const depthGained = new Decimal(softRatePerSec).mul(elapsedMs / 1000);
  if (depthGained.lte(0)) return null;
  return {
    elapsedMs,
    depthGained,
    dirtGained: depthGained.mul(SHAFT_CROSS_SECTION),
  };
}

/** Apply brief full-rate catch-up (mutates). */
export function applyHiddenCatchUp(
  state: GameState,
  catchUp: HiddenCatchUp,
): void {
  if (catchUp.depthGained.lte(0)) return;
  state.depth = state.depth.plus(catchUp.depthGained);
  state.dirt = state.dirt.plus(catchUp.dirtGained);
}

/** Human duration for the claim modal, e.g. `10h 30m`. */
export function formatOfflineDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${Math.max(1, s)}s`;
}
