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
  migrateV3ToV4,
  migrateV4ToV5,
  migrateV5ToV6,
  migrateV6ToV7,
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
    expect(s?.version).toBe(7);
    expect(s?.upgrades.shovel).toBe(0);
    expect(s?.lastPlayedAtMs).toBe(0);
    expect(s?.discoveries.unlocked).toEqual([]);
    expect(s?.boosters.claimed).toEqual([]);
    expect(s?.specialCoins.unlocked).toEqual([]);
  });

  it("migrates version 3 upgrades and clears offline clock", () => {
    const s = parseGameState({
      version: 3,
      depth: "12.5",
      dirt: "50",
      upgrades: { shovel: 2, cart: 1 },
    });
    expect(s?.depth.toNumber()).toBe(12.5);
    expect(s?.upgrades.shovel).toBe(2);
    expect(s?.upgrades.cart).toBe(1);
    expect(s?.version).toBe(7);
    expect(s?.lastPlayedAtMs).toBe(0);
  });

  it("migrates version 4 into discoveries", () => {
    const s = parseGameState({
      version: 4,
      depth: "3",
      dirt: "12",
      upgrades: { cart: 1 },
      lastPlayedAtMs: 1_700_000_000_000,
    });
    expect(s?.lastPlayedAtMs).toBe(1_700_000_000_000);
    expect(s?.upgrades.cart).toBe(1);
    expect(s?.version).toBe(7);
    expect(s?.discoveries.unlocked).toEqual([]);
    expect(s?.discoveries.worldSeed).toBeGreaterThan(0);
  });

  it("migrates version 5 into empty booster claims", () => {
    const s = parseGameState({
      version: 5,
      depth: "30",
      dirt: "120",
      upgrades: {},
      lastPlayedAtMs: 1,
      discoveries: {
        unlocked: ["bone_shard"],
        worldSeed: 7,
        digRollMeter: 0.2,
      },
    });
    expect(s?.discoveries.unlocked).toEqual(["bone_shard"]);
    expect(s?.discoveries.worldSeed).toBe(7);
    expect(s?.version).toBe(7);
    expect(s?.boosters.claimed).toEqual([]);
    expect(
      migrateV5ToV6({
        version: 5,
        depth: "1",
        dirt: "4",
        upgrades: {},
        lastPlayedAtMs: 0,
        discoveries: { unlocked: [], worldSeed: 1, digRollMeter: 0 },
      })?.boosters.claimed,
    ).toEqual([]);
  });

  it("migrates version 6 into empty special coins", () => {
    const s = parseGameState({
      version: 6,
      depth: "30",
      dirt: "120",
      upgrades: {},
      lastPlayedAtMs: 1,
      discoveries: {
        unlocked: ["bone_shard"],
        worldSeed: 7,
        digRollMeter: 0.2,
      },
      boosters: { claimed: ["b0", "b1"], dirtEarned: 300 },
    });
    expect(s?.boosters.claimed).toEqual(["b0", "b1"]);
    expect(s?.boosters.dirtEarned).toBe(300);
    expect(s?.specialCoins.unlocked).toEqual([]);
    expect(s?.version).toBe(7);
    expect(
      migrateV6ToV7({
        version: 6,
        depth: "1",
        dirt: "4",
        upgrades: {},
        lastPlayedAtMs: 0,
        discoveries: { unlocked: [], worldSeed: 1, digRollMeter: 0 },
        boosters: { claimed: [], dirtEarned: 0 },
      })?.specialCoins.unlocked,
    ).toEqual([]);
  });

  it("accepts version 7 with special coins", () => {
    const s = parseGameState({
      version: 7,
      depth: "30",
      dirt: "120",
      upgrades: {},
      lastPlayedAtMs: 1,
      discoveries: {
        unlocked: ["bone_shard"],
        worldSeed: 7,
        digRollMeter: 0.2,
      },
      boosters: { claimed: ["b0"], dirtEarned: 100 },
      specialCoins: { unlocked: ["copper_bit"] },
    });
    expect(s?.specialCoins.unlocked).toEqual(["copper_bit"]);
    expect(s?.version).toBe(7);
  });

  it("rejects version 1", () => {
    expect(
      parseGameState({ version: 1, depth: 1, dirt: 1, digPower: 1 }),
    ).toBeNull();
  });
});

describe("migrate helpers", () => {
  it("migrateV2ToV3 returns null for non-v2", () => {
    expect(migrateV2ToV3({ version: 3, depth: 1, dirt: 1 })).toBeNull();
  });

  it("migrateV3ToV4 returns null for non-v3", () => {
    expect(migrateV3ToV4({ version: 4, depth: 1, dirt: 1 })).toBeNull();
  });

  it("migrateV4ToV5 returns null for non-v4", () => {
    expect(migrateV4ToV5({ version: 5, depth: 1, dirt: 1 })).toBeNull();
  });

  it("migrateV6ToV7 returns null for non-v6", () => {
    expect(migrateV6ToV7({ version: 7, depth: 1, dirt: 1 })).toBeNull();
  });
});

describe("saveGameState / loadGameState", () => {
  it("round-trips through SaveStore as strings", async () => {
    const store = createMemorySaveStore();
    const state = createInitialState({
      depth: 4,
      dirt: 16,
      upgrades: { shovel: 1 },
      lastPlayedAtMs: 42,
    });
    await saveGameState(store, state);
    const raw = await store.load();
    expect(raw).toMatchObject({
      version: 7,
      depth: "4",
      dirt: "16",
      lastPlayedAtMs: 42,
      upgrades: expect.objectContaining({ shovel: 1 }),
      discoveries: expect.objectContaining({
        unlocked: [],
        worldSeed: expect.any(Number),
      }),
      boosters: { claimed: [], dirtEarned: 0 },
      specialCoins: { unlocked: [] },
    });
    const loaded = await loadGameState(store);
    expect(loaded?.depth.eq(state.depth)).toBe(true);
    expect(loaded?.dirt.eq(state.dirt)).toBe(true);
    expect(loaded?.upgrades.shovel).toBe(1);
    expect(loaded?.lastPlayedAtMs).toBe(42);
    expect(loaded?.discoveries.worldSeed).toBe(state.discoveries.worldSeed);
    expect(loaded?.boosters.claimed).toEqual([]);
    expect(loaded?.boosters.dirtEarned).toBe(0);
    expect(loaded?.specialCoins.unlocked).toEqual([]);
  });

  it("serialize omits legacy digPower", () => {
    const state = createInitialState({ upgrades: { shovel: 1 } });
    const blob = serializeGameState(state);
    expect(blob).not.toHaveProperty("digPower");
    expect(blob.upgrades.shovel).toBe(1);
    expect(blob).toHaveProperty("lastPlayedAtMs");
    expect(blob.specialCoins).toEqual({ unlocked: [] });
  });
});
