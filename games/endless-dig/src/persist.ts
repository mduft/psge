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

/** Migrate a v2 save blob into a v3 GameState (discards digPower). */
export function migrateV2ToV3(data: Record<string, unknown>): GameState | null {
  if (data.version !== 2) return null;
  const depth = parseDecimalField(data.depth);
  const dirt = parseDecimalField(data.dirt);
  if (!depth || !dirt) return null;
  return createInitialState({
    version: DIG_SAVE_VERSION,
    depth,
    dirt,
    upgrades: {},
  });
}

export function parseGameState(data: unknown): GameState | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  if (o.version === 2) {
    return migrateV2ToV3(o);
  }

  if (o.version !== DIG_SAVE_VERSION) return null;

  const depth = parseDecimalField(o.depth);
  const dirt = parseDecimalField(o.dirt);
  if (!depth || !dirt) return null;

  const upgrades =
    o.upgrades && typeof o.upgrades === "object"
      ? normalizeUpgrades(o.upgrades as Record<string, unknown>)
      : normalizeUpgrades(undefined);

  return createInitialState({
    version: DIG_SAVE_VERSION,
    depth,
    dirt,
    upgrades,
  });
}

export function serializeGameState(state: GameState): SerializedGameState {
  return {
    version: DIG_SAVE_VERSION,
    depth: state.depth.toString(),
    dirt: state.dirt.toString(),
    upgrades: { ...state.upgrades },
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
