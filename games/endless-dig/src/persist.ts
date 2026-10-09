/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import type { SaveStore } from "@psge/engine";
import {
  createInitialState,
  DEFAULT_DIG_POWER,
  type GameState,
} from "./gameState.js";

export const DIG_SAVE_KEY = "psge:endless-dig:save";

/** Accepted save blob version (matches GameState.version). */
export const DIG_SAVE_VERSION = 2;

export function parseGameState(data: unknown): GameState | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (o.version !== DIG_SAVE_VERSION) return null;
  if (typeof o.depth !== "number" || !Number.isFinite(o.depth) || o.depth < 0) {
    return null;
  }
  if (typeof o.dirt !== "number" || !Number.isFinite(o.dirt) || o.dirt < 0) {
    return null;
  }
  if (
    typeof o.digPower !== "number" ||
    !Number.isFinite(o.digPower) ||
    o.digPower <= 0
  ) {
    return null;
  }
  return createInitialState({
    version: DIG_SAVE_VERSION,
    depth: o.depth,
    dirt: o.dirt,
    digPower: o.digPower,
  });
}

export function serializeGameState(state: GameState): GameState {
  return {
    version: DIG_SAVE_VERSION,
    depth: state.depth,
    dirt: state.dirt,
    digPower: state.digPower > 0 ? state.digPower : DEFAULT_DIG_POWER,
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
