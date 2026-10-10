/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import Decimal from "decimal.js";
import type { SaveStore } from "@psge/engine";
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
  type DiscoveryProgress,
} from "./discoveries.js";
import {
  createInitialState,
  GAME_STATE_VERSION,
  type GameState,
} from "./gameState.js";
import {
  emptyPanelSeen,
  normalizePanelSeen,
  panelSeenFromUnlocked,
  type PanelSeenProgress,
} from "./panelSeen.js";
import {
  emptySpecialCoinProgress,
  normalizeSpecialCoinProgress,
  type SpecialCoinProgress,
} from "./specialCoins.js";
import { normalizeUpgrades } from "./upgrades.js";

export const DIG_SAVE_KEY = "psge:digger:save";

/** Accepted save blob version (matches GameState.version). */
export const DIG_SAVE_VERSION = GAME_STATE_VERSION;

export interface SerializedGameState {
  version: number;
  depth: string;
  dirt: string;
  upgrades: Record<string, number>;
  lastPlayedAtMs: number;
  autoDigPaused: boolean;
  discoveries: DiscoveryProgress;
  boosters: BoosterProgress;
  specialCoins: SpecialCoinProgress;
  achievements: AchievementProgress;
  panelSeen: PanelSeenProgress;
}

function parseDecimalField(value: unknown): Decimal | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return new Decimal(value);
  }
  if (typeof value === "string" && value.length > 0) {
    try {
      const d = new Decimal(value);
      if (d.isFinite() && d.gte(0)) return d;
    } catch {
      return null;
    }
  }
  return null;
}

/** Coerce save `version` (number or numeric string) to an integer. */
export function parseSaveVersion(value: unknown): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value)
  ) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    if (Number.isFinite(n) && Number.isInteger(n)) return n;
  }
  return null;
}

function parseLastPlayedAtMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.length > 0) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}

function parseAutoDigPaused(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function stateFromFields(
  depth: Decimal,
  dirt: Decimal,
  upgrades: ReturnType<typeof normalizeUpgrades>,
  lastPlayedAtMs: number,
  discoveries?: DiscoveryProgress,
  boosters?: BoosterProgress,
  specialCoins?: SpecialCoinProgress,
  achievements?: AchievementProgress,
  panelSeen?: PanelSeenProgress,
  autoDigPaused = false,
): GameState {
  return createInitialState({
    version: DIG_SAVE_VERSION,
    depth,
    dirt,
    upgrades,
    lastPlayedAtMs,
    autoDigPaused,
    discoveries: discoveries ?? emptyDiscoveryProgress(),
    boosters: boosters ?? emptyBoosterProgress(),
    specialCoins: specialCoins ?? emptySpecialCoinProgress(),
    achievements: achievements ?? emptyAchievementProgress(),
    panelSeen: panelSeen ?? emptyPanelSeen(),
  });
}

/** Migrate a v2 save blob into current GameState (discards digPower). */
export function migrateV2ToV3(data: Record<string, unknown>): GameState | null {
  if (parseSaveVersion(data.version) !== 2) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (depth === null || dirt === null) return null;
  return stateFromFields(depth, dirt, normalizeUpgrades(undefined), 0);
}

/** Migrate a v3 save blob into v4 (adds lastPlayedAtMs = 0). */
export function migrateV3ToV4(data: Record<string, unknown>): GameState | null {
  if (parseSaveVersion(data.version) !== 3) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (depth === null || dirt === null) return null;
  const upgrades =
    data.upgrades && typeof data.upgrades === "object"
      ? normalizeUpgrades(data.upgrades as Record<string, unknown>)
      : normalizeUpgrades(undefined);
  return stateFromFields(depth, dirt, upgrades, 0);
}

/** Migrate a v4 save into v5 (adds empty discoveries + world seed). */
export function migrateV4ToV5(data: Record<string, unknown>): GameState | null {
  if (parseSaveVersion(data.version) !== 4) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (depth === null || dirt === null) return null;
  const upgrades =
    data.upgrades && typeof data.upgrades === "object"
      ? normalizeUpgrades(data.upgrades as Record<string, unknown>)
      : normalizeUpgrades(undefined);
  const seed =
    ((Date.now() ^ Math.floor(depth.toNumber())) >>> 0) || 1;
  return stateFromFields(
    depth,
    dirt,
    upgrades,
    parseLastPlayedAtMs(data.lastPlayedAtMs),
    emptyDiscoveryProgress(seed),
  );
}

/** Migrate a v5 save into v6 (adds empty booster claims). */
export function migrateV5ToV6(data: Record<string, unknown>): GameState | null {
  if (parseSaveVersion(data.version) !== 5) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (depth === null || dirt === null) return null;
  const upgrades =
    data.upgrades && typeof data.upgrades === "object"
      ? normalizeUpgrades(data.upgrades as Record<string, unknown>)
      : normalizeUpgrades(undefined);
  const fallbackSeed =
    ((Date.now() ^ Math.floor(depth.toNumber())) >>> 0) || 1;
  const discoveries = normalizeDiscoveryProgress(
    data.discoveries,
    fallbackSeed,
  );
  return stateFromFields(
    depth,
    dirt,
    upgrades,
    parseLastPlayedAtMs(data.lastPlayedAtMs),
    discoveries,
    emptyBoosterProgress(),
  );
}

/** Migrate a v6 save into v7 (adds empty special-coin collection). */
export function migrateV6ToV7(data: Record<string, unknown>): GameState | null {
  if (parseSaveVersion(data.version) !== 6) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (depth === null || dirt === null) return null;
  const upgrades =
    data.upgrades && typeof data.upgrades === "object"
      ? normalizeUpgrades(data.upgrades as Record<string, unknown>)
      : normalizeUpgrades(undefined);
  const fallbackSeed =
    ((Date.now() ^ Math.floor(depth.toNumber())) >>> 0) || 1;
  const discoveries = normalizeDiscoveryProgress(
    data.discoveries,
    fallbackSeed,
  );
  const boosters = normalizeBoosterProgress(data.boosters);
  return stateFromFields(
    depth,
    dirt,
    upgrades,
    parseLastPlayedAtMs(data.lastPlayedAtMs),
    discoveries,
    boosters,
    emptySpecialCoinProgress(),
    emptyAchievementProgress(),
  );
}

/** Migrate a v7 save into v8 (adds empty achievements). */
export function migrateV7ToV8(data: Record<string, unknown>): GameState | null {
  if (parseSaveVersion(data.version) !== 7) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (depth === null || dirt === null) return null;
  const upgrades =
    data.upgrades && typeof data.upgrades === "object"
      ? normalizeUpgrades(data.upgrades as Record<string, unknown>)
      : normalizeUpgrades(undefined);
  const fallbackSeed =
    ((Date.now() ^ Math.floor(depth.toNumber())) >>> 0) || 1;
  const discoveries = normalizeDiscoveryProgress(
    data.discoveries,
    fallbackSeed,
  );
  const boosters = normalizeBoosterProgress(data.boosters);
  const specialCoins = normalizeSpecialCoinProgress(data.specialCoins);
  return stateFromFields(
    depth,
    dirt,
    upgrades,
    parseLastPlayedAtMs(data.lastPlayedAtMs),
    discoveries,
    boosters,
    specialCoins,
    emptyAchievementProgress(),
  );
}

/** Migrate a v8 save into v9 (panelSeen; existing unlocks count as viewed). */
export function migrateV8ToV9(data: Record<string, unknown>): GameState | null {
  if (parseSaveVersion(data.version) !== 8) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (depth === null || dirt === null) return null;
  const upgrades =
    data.upgrades && typeof data.upgrades === "object"
      ? normalizeUpgrades(data.upgrades as Record<string, unknown>)
      : normalizeUpgrades(undefined);
  const fallbackSeed =
    ((Date.now() ^ Math.floor(depth.toNumber())) >>> 0) || 1;
  const discoveries = normalizeDiscoveryProgress(
    data.discoveries,
    fallbackSeed,
  );
  const boosters = normalizeBoosterProgress(data.boosters);
  const specialCoins = normalizeSpecialCoinProgress(data.specialCoins);
  const achievements = normalizeAchievements(data.achievements);
  return stateFromFields(
    depth,
    dirt,
    upgrades,
    parseLastPlayedAtMs(data.lastPlayedAtMs),
    discoveries,
    boosters,
    specialCoins,
    achievements,
    panelSeenFromUnlocked({ discoveries, specialCoins, achievements }),
  );
}

/** Migrate a v9 save into v10 (dirt-coin combo streak fields). */
export function migrateV9ToV10(data: Record<string, unknown>): GameState | null {
  if (parseSaveVersion(data.version) !== 9) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (depth === null || dirt === null) return null;
  const upgrades =
    data.upgrades && typeof data.upgrades === "object"
      ? normalizeUpgrades(data.upgrades as Record<string, unknown>)
      : normalizeUpgrades(undefined);
  const fallbackSeed =
    ((Date.now() ^ Math.floor(depth.toNumber())) >>> 0) || 1;
  const discoveries = normalizeDiscoveryProgress(
    data.discoveries,
    fallbackSeed,
  );
  const boosters = normalizeBoosterProgress(data.boosters);
  const specialCoins = normalizeSpecialCoinProgress(data.specialCoins);
  const achievements = normalizeAchievements(data.achievements);
  const panelSeen = normalizePanelSeen(data.panelSeen);
  return stateFromFields(
    depth,
    dirt,
    upgrades,
    parseLastPlayedAtMs(data.lastPlayedAtMs),
    discoveries,
    boosters,
    specialCoins,
    achievements,
    panelSeen,
  );
}

/** Migrate a v10 save into v11 (auto-dig pause; default unpaused). */
export function migrateV10ToV11(data: Record<string, unknown>): GameState | null {
  if (parseSaveVersion(data.version) !== 10) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (depth === null || dirt === null) return null;
  const upgrades =
    data.upgrades && typeof data.upgrades === "object"
      ? normalizeUpgrades(data.upgrades as Record<string, unknown>)
      : normalizeUpgrades(undefined);
  const fallbackSeed =
    ((Date.now() ^ Math.floor(depth.toNumber())) >>> 0) || 1;
  const discoveries = normalizeDiscoveryProgress(
    data.discoveries,
    fallbackSeed,
  );
  const boosters = normalizeBoosterProgress(data.boosters);
  const specialCoins = normalizeSpecialCoinProgress(data.specialCoins);
  const achievements = normalizeAchievements(data.achievements);
  const panelSeen = normalizePanelSeen(data.panelSeen);
  return stateFromFields(
    depth,
    dirt,
    upgrades,
    parseLastPlayedAtMs(data.lastPlayedAtMs),
    discoveries,
    boosters,
    specialCoins,
    achievements,
    panelSeen,
    false,
  );
}

export function parseGameState(data: unknown): GameState | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const version = parseSaveVersion(o.version);
  if (version === null) return null;

  if (version === 2) return migrateV2ToV3(o);
  if (version === 3) return migrateV3ToV4(o);
  if (version === 4) return migrateV4ToV5(o);
  if (version === 5) return migrateV5ToV6(o);
  if (version === 6) return migrateV6ToV7(o);
  if (version === 7) return migrateV7ToV8(o);
  if (version === 8) return migrateV8ToV9(o);
  if (version === 9) return migrateV9ToV10(o);
  if (version === 10) return migrateV10ToV11(o);

  if (version !== DIG_SAVE_VERSION) return null;

  const depth = parseDecimalField(o.depth);
  const dirt = parseDecimalField(o.dirt);
  if (depth === null || dirt === null) return null;

  const upgrades =
    o.upgrades && typeof o.upgrades === "object"
      ? normalizeUpgrades(o.upgrades as Record<string, unknown>)
      : normalizeUpgrades(undefined);

  const fallbackSeed =
    ((Date.now() ^ Math.floor(depth.toNumber())) >>> 0) || 1;
  const discoveries = normalizeDiscoveryProgress(o.discoveries, fallbackSeed);
  const boosters = normalizeBoosterProgress(o.boosters);
  const specialCoins = normalizeSpecialCoinProgress(o.specialCoins);
  const achievements = normalizeAchievements(o.achievements);
  const panelSeen = normalizePanelSeen(o.panelSeen);

  return stateFromFields(
    depth,
    dirt,
    upgrades,
    parseLastPlayedAtMs(o.lastPlayedAtMs),
    discoveries,
    boosters,
    specialCoins,
    achievements,
    panelSeen,
    parseAutoDigPaused(o.autoDigPaused),
  );
}

export function serializeGameState(state: GameState): SerializedGameState {
  return {
    version: DIG_SAVE_VERSION,
    depth: state.depth.toString(),
    dirt: state.dirt.toString(),
    upgrades: { ...state.upgrades },
    lastPlayedAtMs: state.lastPlayedAtMs,
    autoDigPaused: state.autoDigPaused === true,
    discoveries: {
      unlocked: [...state.discoveries.unlocked],
      worldSeed: state.discoveries.worldSeed,
      digRollMeter: state.discoveries.digRollMeter,
    },
    boosters: {
      claimed: [...state.boosters.claimed],
      dirtEarned: state.boosters.dirtEarned,
      combo: state.boosters.combo,
      comboAtMs: state.boosters.comboAtMs,
    },
    specialCoins: {
      unlocked: [...state.specialCoins.unlocked],
    },
    achievements: {
      unlocked: [...state.achievements.unlocked],
      afkDigSeen: state.achievements.afkDigSeen,
      overnightClaimed: state.achievements.overnightClaimed,
      mineshaftSeen: state.achievements.mineshaftSeen,
      seenMinecarts: [...state.achievements.seenMinecarts],
      claimedMinecarts: [...state.achievements.claimedMinecarts],
      claimedBarrels: [...state.achievements.claimedBarrels],
      claimedCrates: [...state.achievements.claimedCrates],
    },
    panelSeen: {
      discoveries: [...state.panelSeen.discoveries],
      specialCoins: [...state.panelSeen.specialCoins],
      achievements: [...state.panelSeen.achievements],
    },
  };
}

export async function loadGameState(
  store: SaveStore,
): Promise<GameState | null> {
  return parseGameState(await store.load());
}

export async function saveGameState(
  store: SaveStore,
  state: GameState,
): Promise<void> {
  await store.save(serializeGameState(state));
}
