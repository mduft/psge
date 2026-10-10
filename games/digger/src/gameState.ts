/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import Decimal from "decimal.js";
import {
  emptyAchievementProgress,
  normalizeAchievements,
  type AchievementProgress,
} from "./achievements.js";
import {
  emptyBoosterProgress,
  normalizeBoosterProgress,
  type BoosterProgress,
} from "./boosters.js";
import {
  emptyDiscoveryProgress,
  normalizeDiscoveryProgress,
  resolveDiscoveries,
  type DiscoveryProgress,
} from "./discoveries.js";
import {
  emptyPanelSeen,
  normalizePanelSeen,
  type PanelSeenProgress,
} from "./panelSeen.js";
import {
  emptySpecialCoinProgress,
  normalizeSpecialCoinProgress,
  type SpecialCoinProgress,
} from "./specialCoins.js";
import {
  DEFAULT_DIG_POWER,
  emptyUpgrades,
  getUpgradeDef,
  type UpgradeId,
  type UpgradeLevels,
  UPGRADE_IDS,
  upgradeCost,
} from "./upgrades.js";
import { applyLayerHardness } from "./geoLayers.js";
import { softDigAmount } from "./softDig.js";

export { DEFAULT_DIG_POWER };

/** 2×2 shaft cells — dirt granted per block of depth dug. */
export const SHAFT_CROSS_SECTION = 4;

/** Persist / GameState schema version (v11+: auto-dig pause). */
export const GAME_STATE_VERSION = 11;

export interface GameState {
  version: number;
  /** Excavated depth in blocks (positive = down from surface). */
  depth: Decimal;
  /** Accumulated material removed (spendable). */
  dirt: Decimal;
  /** Owned upgrade levels. */
  upgrades: UpgradeLevels;
  /**
   * Wall-clock ms when the player was last active (saved on autosave).
   * `0` means unknown — no offline claim on load.
   */
  lastPlayedAtMs: number;
  /** When true, live auto-dig is paused (persisted across sessions). */
  autoDigPaused: boolean;
  /** M7 discovery collection + roll state. */
  discoveries: DiscoveryProgress;
  /** Claimed shaft dirt-coin boosters. */
  boosters: BoosterProgress;
  /** Rare collectible special coins (20 unique). */
  specialCoins: SpecialCoinProgress;
  /** M9 meta unlocks (celebration chrome). */
  achievements: AchievementProgress;
  /** Unlocked ids opened in Finds / Coins / Goals tabs. */
  panelSeen: PanelSeenProgress;
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
    lastPlayedAtMs?: number;
    autoDigPaused?: boolean;
    discoveries?: DiscoveryProgress | Partial<DiscoveryProgress>;
    boosters?: BoosterProgress | Partial<BoosterProgress>;
    specialCoins?: SpecialCoinProgress | Partial<SpecialCoinProgress>;
    achievements?: AchievementProgress | Partial<AchievementProgress>;
    panelSeen?: PanelSeenProgress | Partial<PanelSeenProgress>;
    worldSeed?: number;
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
  const last =
    typeof overrides.lastPlayedAtMs === "number" &&
    Number.isFinite(overrides.lastPlayedAtMs) &&
    overrides.lastPlayedAtMs >= 0
      ? Math.floor(overrides.lastPlayedAtMs)
      : 0;
  const depth = toDecimal(overrides.depth ?? 0);
  const defaultSeed =
    ((Date.now() ^ Math.floor(depth.toNumber())) >>> 0) || 1;
  const discoveries = overrides.discoveries
    ? normalizeDiscoveryProgress(overrides.discoveries, overrides.worldSeed)
    : emptyDiscoveryProgress(overrides.worldSeed ?? defaultSeed);
  const boosters = overrides.boosters
    ? normalizeBoosterProgress(overrides.boosters)
    : emptyBoosterProgress();
  const specialCoins = overrides.specialCoins
    ? normalizeSpecialCoinProgress(overrides.specialCoins)
    : emptySpecialCoinProgress();
  const achievements = overrides.achievements
    ? normalizeAchievements(overrides.achievements)
    : emptyAchievementProgress();
  const panelSeen = overrides.panelSeen
    ? normalizePanelSeen(overrides.panelSeen)
    : emptyPanelSeen();
  return {
    version: overrides.version ?? GAME_STATE_VERSION,
    depth,
    dirt: toDecimal(overrides.dirt ?? 0),
    upgrades,
    lastPlayedAtMs: last,
    autoDigPaused: overrides.autoDigPaused === true,
    discoveries,
    boosters,
    specialCoins,
    achievements,
    panelSeen,
  };
}

export function digPowerOf(state: GameState): Decimal {
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

/**
 * Soft-capped then hardness-scaled dig (m/tap) — what `dig()` actually applies.
 * Prefer for HUD so deep layers do not overstate power.
 */
export function effectiveDigPowerOf(state: GameState): number {
  return applyLayerHardness(
    softDigAmount(digPowerOf(state).toNumber()),
    state.depth.toNumber(),
  );
}

/**
 * Soft-capped then hardness-scaled passive rate (m/s) — what `tickProduction`
 * actually applies.
 */
export function effectivePassiveRateOf(state: GameState): number {
  return applyLayerHardness(
    softDigAmount(passiveRateOf(state).toNumber()),
    state.depth.toNumber(),
  );
}

/**
 * Apply depth/dirt gain and resolve discoveries over the span.
 * @returns newly unlocked discovery ids (may be empty).
 */
export function applyDepthGain(
  state: GameState,
  gained: Decimal,
): string[] {
  if (gained.lte(0)) return [];
  const before = state.depth.toNumber();
  state.depth = state.depth.plus(gained);
  state.dirt = state.dirt.plus(gained.mul(SHAFT_CROSS_SECTION));
  const after = state.depth.toNumber();
  return resolveDiscoveries(state.discoveries, before, after).newlyUnlocked;
}

/**
 * Straight-down dig. Mutates `state` in place.
 * Caps depth at `maxDepth` when provided (world generation extent).
 * Nominal dig power is soft-capped so high gear does not remove linearly.
 * @returns newly unlocked discovery ids.
 */
export function dig(state: GameState, maxDepth?: Decimal.Value): string[] {
  const power = Decimal.max(0, digPowerOf(state));
  const soft = softDigAmount(power.toNumber());
  const gained = new Decimal(
    applyLayerHardness(soft, state.depth.toNumber()),
  );
  let next = state.depth.plus(gained);
  if (maxDepth !== undefined) {
    next = Decimal.min(next, Decimal.max(0, toDecimal(maxDepth)));
  }
  return applyDepthGain(state, next.minus(state.depth));
}

/**
 * Apply passive digging for `dt` seconds.
 * Soft-caps the nominal blocks/s the same way as tap dig power, then applies
 * geological layer hardness at the current depth.
 * @returns newly unlocked ids (empty if depth unchanged).
 */
export function tickProduction(
  state: GameState,
  dt: number,
  maxDepth?: Decimal.Value,
): string[] {
  if (!Number.isFinite(dt) || dt <= 0) return [];
  const rate = passiveRateOf(state);
  if (rate.lte(0)) return [];
  const softRate = softDigAmount(rate.toNumber());
  const hardRate = applyLayerHardness(softRate, state.depth.toNumber());
  let next = state.depth.plus(new Decimal(hardRate).mul(dt));
  if (maxDepth !== undefined) {
    next = Decimal.min(next, Decimal.max(0, toDecimal(maxDepth)));
  }
  return applyDepthGain(state, next.minus(state.depth));
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

/** Reset progress fields (keeps a fresh world seed). */
export function resetProgress(state: GameState): void {
  state.depth = new Decimal(0);
  state.dirt = new Decimal(0);
  state.upgrades = emptyUpgrades();
  state.version = GAME_STATE_VERSION;
  state.lastPlayedAtMs = 0;
  state.autoDigPaused = false;
  state.discoveries = emptyDiscoveryProgress();
  state.boosters = emptyBoosterProgress();
  state.specialCoins = emptySpecialCoinProgress();
  state.achievements = emptyAchievementProgress();
  state.panelSeen = emptyPanelSeen();
}
