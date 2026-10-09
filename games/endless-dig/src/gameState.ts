/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import Decimal from "decimal.js";
import {
  DEFAULT_DIG_POWER,
  emptyUpgrades,
  getUpgradeDef,
  type UpgradeId,
  type UpgradeLevels,
  UPGRADE_IDS,
  upgradeCost,
} from "./upgrades.js";

export { DEFAULT_DIG_POWER };

/** 2×2 shaft cells — dirt granted per block of depth dug. */
export const SHAFT_CROSS_SECTION = 4;

/** Persist / GameState schema version (M4+). */
export const GAME_STATE_VERSION = 3;

export interface GameState {
  version: number;
  /** Excavated depth in blocks (positive = down from surface). */
  depth: Decimal;
  /** Accumulated material removed (spendable). */
  dirt: Decimal;
  /** Owned upgrade levels. */
  upgrades: UpgradeLevels;
  /**
   * Debug-only dig power override (not persisted).
   * When set, replaces derived dig power for taps.
   */
  debugDigPower?: number;
}

export function toDecimal(value: Decimal.Value): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function createInitialState(
  overrides: {
    version?: number;
    depth?: Decimal.Value;
    dirt?: Decimal.Value;
    upgrades?: Partial<UpgradeLevels>;
    debugDigPower?: number;
  } = {},
): GameState {
  const upgrades = emptyUpgrades();
  if (overrides.upgrades) {
    for (const id of UPGRADE_IDS) {
      const v = overrides.upgrades[id];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        upgrades[id] = Math.floor(v);
      }
    }
  }
  return {
    version: overrides.version ?? GAME_STATE_VERSION,
    depth: toDecimal(overrides.depth ?? 0),
    dirt: toDecimal(overrides.dirt ?? 0),
    upgrades,
    ...(overrides.debugDigPower !== undefined
      ? { debugDigPower: overrides.debugDigPower }
      : {}),
  };
}

export function digPowerOf(state: GameState): Decimal {
  if (
    state.debugDigPower !== undefined &&
    Number.isFinite(state.debugDigPower) &&
    state.debugDigPower > 0
  ) {
    return new Decimal(state.debugDigPower);
  }
  let power = new Decimal(DEFAULT_DIG_POWER);
  for (const id of UPGRADE_IDS) {
    const def = getUpgradeDef(id);
    if (def.digPowerPerLevel === 0) continue;
    power = power.plus(
      new Decimal(def.digPowerPerLevel).mul(state.upgrades[id]),
    );
  }
  return power;
}

export function passiveRateOf(state: GameState): Decimal {
  let rate = new Decimal(0);
  for (const id of UPGRADE_IDS) {
    const def = getUpgradeDef(id);
    if (def.passivePerLevel === 0) continue;
    rate = rate.plus(
      new Decimal(def.passivePerLevel).mul(state.upgrades[id]),
    );
  }
  return rate;
}

function applyDepthGain(state: GameState, gained: Decimal): void {
  if (gained.lte(0)) return;
  state.depth = state.depth.plus(gained);
  state.dirt = state.dirt.plus(gained.mul(SHAFT_CROSS_SECTION));
}

/**
 * Straight-down dig. Mutates `state` in place.
 * Caps depth at `maxDepth` when provided (world generation extent).
 */
export function dig(state: GameState, maxDepth?: Decimal.Value): void {
  const power = Decimal.max(0, digPowerOf(state));
  let next = state.depth.plus(power);
  if (maxDepth !== undefined) {
    next = Decimal.min(next, Decimal.max(0, toDecimal(maxDepth)));
  }
  applyDepthGain(state, next.minus(state.depth));
}

/**
 * Apply passive digging for `dt` seconds.
 * @returns true if depth changed.
 */
export function tickProduction(
  state: GameState,
  dt: number,
  maxDepth?: Decimal.Value,
): boolean {
  if (!Number.isFinite(dt) || dt <= 0) return false;
  const rate = passiveRateOf(state);
  if (rate.lte(0)) return false;
  const before = state.depth;
  let next = state.depth.plus(rate.mul(dt));
  if (maxDepth !== undefined) {
    next = Decimal.min(next, Decimal.max(0, toDecimal(maxDepth)));
  }
  applyDepthGain(state, next.minus(state.depth));
  return state.depth.gt(before);
}

export function canBuyUpgrade(state: GameState, id: UpgradeId): boolean {
  const cost = upgradeCost(id, state.upgrades[id]);
  return state.dirt.gte(cost);
}

/**
 * Spend dirt for one upgrade level. Returns false if unaffordable.
 */
export function buyUpgrade(state: GameState, id: UpgradeId): boolean {
  const cost = upgradeCost(id, state.upgrades[id]);
  if (state.dirt.lt(cost)) return false;
  state.dirt = state.dirt.minus(cost);
  state.upgrades[id] += 1;
  return true;
}

/** Reset progress fields (keeps debugDigPower if any). */
export function resetProgress(state: GameState): void {
  state.depth = new Decimal(0);
  state.dirt = new Decimal(0);
  state.upgrades = emptyUpgrades();
  state.version = GAME_STATE_VERSION;
}
