/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import { createMemorySaveStore } from "@psge/engine";
import { createInitialState } from "../src/gameState.js";
import {
  loadGameState,
  migrateV2ToV3,
  parseGameState,
  saveGameState,
  serializeGameState,
} from "../src/persist.js";

describe("parseGameState", () => {
  it("migrates version 2 blobs and drops digPower", () => {
    const s = parseGameState({
      version: 2,
      depth: 1.5,
      dirt: 6,
      digPower: 0.5,
    });
    expect(s?.depth.toNumber()).toBe(1.5);
    expect(s?.dirt.toNumber()).toBe(6);
    expect(s?.version).toBe(3);
    expect(s?.upgrades.shovel).toBe(0);
  });

  it("accepts version 3 string Decimals + upgrades", () => {
    const s = parseGameState({
      version: 3,
      depth: "12.5",
      dirt: "50",
      upgrades: { shovel: 2, cart: 1 },
    });
    expect(s?.depth.toNumber()).toBe(12.5);
    expect(s?.upgrades.shovel).toBe(2);
    expect(s?.upgrades.cart).toBe(1);
  });

  it("rejects version 1", () => {
    expect(
      parseGameState({ version: 1, depth: 1, dirt: 1, digPower: 1 }),
    ).toBeNull();
  });
});

describe("migrateV2ToV3", () => {
  it("returns null for non-v2", () => {
    expect(migrateV2ToV3({ version: 3, depth: 1, dirt: 1 })).toBeNull();
  });
});

describe("saveGameState / loadGameState", () => {
  it("round-trips through SaveStore as strings", async () => {
    const store = createMemorySaveStore();
    const state = createInitialState({
      depth: 4,
      dirt: 16,
      upgrades: { shovel: 1 },
    });
    await saveGameState(store, state);
    const raw = await store.load();
    expect(raw).toMatchObject({
      version: 3,
      depth: "4",
      dirt: "16",
      upgrades: expect.objectContaining({ shovel: 1 }),
    });
    const loaded = await loadGameState(store);
    expect(loaded?.depth.eq(state.depth)).toBe(true);
    expect(loaded?.dirt.eq(state.dirt)).toBe(true);
    expect(loaded?.upgrades.shovel).toBe(1);
  });

  it("serialize omits legacy digPower", () => {
    const state = createInitialState({ upgrades: { shovel: 1 } });
    const blob = serializeGameState(state);
    expect(blob).not.toHaveProperty("digPower");
    expect(blob.upgrades.shovel).toBe(1);
  });
});
