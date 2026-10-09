/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import Decimal from "decimal.js";
import type { SaveStore } from "@psge/engine";
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
): GameState {
  return createInitialState({
    version: DIG_SAVE_VERSION,
    depth,
    dirt,
    upgrades,
    lastPlayedAtMs,
  });
}

/** Migrate a v2 save blob into current GameState (discards digPower). */
export function migrateV2ToV3(data: Record<string, unknown>): GameState | null {
  if (data.version !== 2) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (!depth || !dirt) return null;
  // v2 → current: no offline clock (avoid a surprise mega-claim).
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

export function parseGameState(data: unknown): GameState | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  if (o.version === 2) return migrateV2ToV3(o);
  if (o.version === 3) return migrateV3ToV4(o);

  if (o.version !== DIG_SAVE_VERSION) return null;

  const depth = parseDecimalField(o.depth);
  const dirt = parseDecimalField(o.dirt);
  if (!depth || !dirt) return null;

  const upgrades =
    o.upgrades && typeof o.upgrades === "object"
      ? normalizeUpgrades(o.upgrades as Record<string, unknown>)
      : normalizeUpgrades(undefined);

  return stateFromFields(
    depth,
    dirt,
    upgrades,
    parseLastPlayedAtMs(o.lastPlayedAtMs),
  );
}

export function serializeGameState(state: GameState): SerializedGameState {
  return {
    version: DIG_SAVE_VERSION,
    depth: state.depth.toString(),
    dirt: state.dirt.toString(),
    upgrades: { ...state.upgrades },
    lastPlayedAtMs: state.lastPlayedAtMs,
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
