/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import { createMemorySaveStore } from "@psge/engine";
import { createInitialState } from "../src/gameState.js";
import {
  loadGameState,
  parseGameState,
  saveGameState,
} from "../src/persist.js";

describe("parseGameState", () => {
  it("accepts version 2 blobs", () => {
    const s = parseGameState({
      version: 2,
      depth: 1.5,
      dirt: 6,
      digPower: 0.5,
    });
    expect(s?.depth).toBe(1.5);
    expect(s?.dirt).toBe(6);
  });

  it("rejects wrong version", () => {
    expect(
      parseGameState({ version: 1, depth: 1, dirt: 1, digPower: 1 }),
    ).toBeNull();
  });
});

describe("saveGameState / loadGameState", () => {
  it("round-trips through SaveStore", async () => {
    const store = createMemorySaveStore();
    const state = createInitialState({ depth: 4, dirt: 16, digPower: 1 });
    await saveGameState(store, state);
    const loaded = await loadGameState(store);
    expect(loaded).toEqual(state);
  });
});
