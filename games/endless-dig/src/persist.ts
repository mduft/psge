/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import Decimal from "decimal.js";
import type { SaveStore } from "@psge/engine";
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
import { normalizeUpgrades } from "./upgrades.js";

export const DIG_SAVE_KEY = "psge:endless-dig:save";

/** Accepted save blob version (matches GameState.version). */
export const DIG_SAVE_VERSION = GAME_STATE_VERSION;

export interface SerializedGameState {
  version: number;
  depth: string;
  dirt: string;
  upgrades: Record<string, number>;
  lastPlayedAtMs: number;
  discoveries: DiscoveryProgress;
  boosters: BoosterProgress;
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

function stateFromFields(
  depth: Decimal,
  dirt: Decimal,
  upgrades: ReturnType<typeof normalizeUpgrades>,
  lastPlayedAtMs: number,
  discoveries?: DiscoveryProgress,
  boosters?: BoosterProgress,
): GameState {
  return createInitialState({
    version: DIG_SAVE_VERSION,
    depth,
    dirt,
    upgrades,
    lastPlayedAtMs,
    discoveries: discoveries ?? emptyDiscoveryProgress(),
    boosters: boosters ?? emptyBoosterProgress(),
  });
}

/** Migrate a v2 save blob into current GameState (discards digPower). */
export function migrateV2ToV3(data: Record<string, unknown>): GameState | null {
  if (data.version !== 2) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (!depth || !dirt) return null;
  return stateFromFields(depth, dirt, normalizeUpgrades(undefined), 0);
}

/** Migrate a v3 save blob into v4 (adds lastPlayedAtMs = 0). */
export function migrateV3ToV4(data: Record<string, unknown>): GameState | null {
  if (data.version !== 3) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (!depth || !dirt) return null;
  const upgrades =
    data.upgrades && typeof data.upgrades === "object"
      ? normalizeUpgrades(data.upgrades as Record<string, unknown>)
      : normalizeUpgrades(undefined);
  return stateFromFields(depth, dirt, upgrades, 0);
}

/** Migrate a v4 save into v5 (adds empty discoveries + world seed). */
export function migrateV4ToV5(data: Record<string, unknown>): GameState | null {
  if (data.version !== 4) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (!depth || !dirt) return null;
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
  if (data.version !== 5) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (!depth || !dirt) return null;
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

export function parseGameState(data: unknown): GameState | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  if (o.version === 2) return migrateV2ToV3(o);
  if (o.version === 3) return migrateV3ToV4(o);
  if (o.version === 4) return migrateV4ToV5(o);
  if (o.version === 5) return migrateV5ToV6(o);

  if (o.version !== DIG_SAVE_VERSION) return null;

  const depth = parseDecimalField(o.depth);
  const dirt = parseDecimalField(o.dirt);
  if (!depth || !dirt) return null;

  const upgrades =
    o.upgrades && typeof o.upgrades === "object"
      ? normalizeUpgrades(o.upgrades as Record<string, unknown>)
      : normalizeUpgrades(undefined);

  const fallbackSeed =
    ((Date.now() ^ Math.floor(depth.toNumber())) >>> 0) || 1;
  const discoveries = normalizeDiscoveryProgress(o.discoveries, fallbackSeed);
  const boosters = normalizeBoosterProgress(o.boosters);

  return stateFromFields(
    depth,
    dirt,
    upgrades,
    parseLastPlayedAtMs(o.lastPlayedAtMs),
    discoveries,
    boosters,
  );
}

export function serializeGameState(state: GameState): SerializedGameState {
  return {
    version: DIG_SAVE_VERSION,
    depth: state.depth.toString(),
    dirt: state.dirt.toString(),
    upgrades: { ...state.upgrades },
    lastPlayedAtMs: state.lastPlayedAtMs,
    discoveries: {
      unlocked: [...state.discoveries.unlocked],
      worldSeed: state.discoveries.worldSeed,
      digRollMeter: state.discoveries.digRollMeter,
    },
    boosters: {
      claimed: [...state.boosters.claimed],
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
