/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */

/** 2×2 shaft cells — dirt granted per block of depth dug. */
export const SHAFT_CROSS_SECTION = 4;

/**
 * Initial dig power in blocks per tap (~one screen pixel of descent at M2 framing).
 * See game AGENTS.md / PSGE.md §7.1.
 */
export const DEFAULT_DIG_POWER = 1 / 32;

export interface GameState {
  version: number;
  /** Excavated depth in blocks (positive = down from surface). */
  depth: number;
  /** Accumulated material removed. */
  dirt: number;
  /** Blocks of depth added per dig action. */
  digPower: number;
}

export function createInitialState(
  overrides: Partial<GameState> = {},
): GameState {
  return {
    version: 2,
    depth: 0,
    dirt: 0,
    digPower: DEFAULT_DIG_POWER,
    ...overrides,
  };
}

/**
 * Straight-down dig. Mutates `state` in place (ordinary data).
 * Caps depth at `maxDepth` when provided (world generation extent).
 */
export function dig(state: GameState, maxDepth?: number): void {
  const power = Math.max(0, state.digPower);
  let next = state.depth + power;
  if (maxDepth !== undefined) {
    next = Math.min(next, Math.max(0, maxDepth));
  }
  const gained = next - state.depth;
  state.depth = next;
  state.dirt += gained * SHAFT_CROSS_SECTION;
}
