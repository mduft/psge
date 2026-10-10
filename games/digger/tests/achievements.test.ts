/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import {
  evaluateAchievements,
  noteAfkDig,
  noteMinecartsSeen,
  noteMineshaftSeen,
  noteOvernightClaim,
} from "../src/achievements.js";
import { DISCOVERY_DEFS } from "../src/discoveries.js";
import { createInitialState, dig } from "../src/gameState.js";

describe("evaluateAchievements", () => {
  it("unlocks first-dig when depth is positive", () => {
    const state = createInitialState();
    expect(evaluateAchievements(state)).toEqual([]);
    dig(state);
    expect(evaluateAchievements(state)).toContain("first-dig");
    expect(evaluateAchievements(state)).toEqual([]);
  });

  it("unlocks depth and layer thresholds", () => {
    const state = createInitialState({ depth: 1_200 });
    const newly = evaluateAchievements(state);
    expect(newly).toContain("first-dig");
    expect(newly).toContain("depth-10");
    expect(newly).toContain("depth-100");
    expect(newly).toContain("depth-1k");
    expect(newly).toContain("layer-clay");
    expect(newly).not.toContain("depth-10k");
  });

  it("unlocks shop and discovery achievements", () => {
    const state = createInitialState({
      upgrades: { shovel: 1, pickaxe: 1, jackhammer: 1, cart: 1 },
      dirt: 5_000,
      discoveries: {
        unlocked: DISCOVERY_DEFS.slice(0, 5).map((d) => d.id),
        worldSeed: 1,
        digRollMeter: 0,
      },
    });
    const newly = evaluateAchievements(state);
    expect(newly).toContain("first-purchase");
    expect(newly).toContain("own-shovel");
    expect(newly).toContain("full-kit");
    expect(newly).toContain("cart-crew");
    expect(newly).toContain("dirt-hoarder");
    expect(newly).toContain("first-find");
    expect(newly).toContain("collector");
    expect(newly).not.toContain("museum");
  });

  it("unlocks deep depth tiers in order", () => {
    const at100k = createInitialState({ depth: 150_000 });
    const newly = evaluateAchievements(at100k);
    expect(newly).toContain("depth-10k");
    expect(newly).toContain("depth-100k");
    expect(newly).toContain("layer-abyss");
    expect(newly).not.toContain("depth-1m");

    const at10m = createInitialState({ depth: 10_000_000 });
    const deep = evaluateAchievements(at10m);
    expect(deep).toContain("depth-1m");
    expect(deep).toContain("depth-10m");
  });

  it("unlocks auto fleet and per-upgrade level tiers", () => {
    const state = createInitialState({
      upgrades: { shovel: 10, pickaxe: 3, cart: 1, drill: 1, crew: 12 },
    });
    const newly = evaluateAchievements(state);
    expect(newly).toContain("own-drill");
    expect(newly).toContain("own-crew");
    expect(newly).toContain("full-fleet");
    expect(newly).toContain("shovel-10");
    expect(newly).toContain("crew-10");
    expect(newly).not.toContain("pickaxe-10");
    expect(newly).not.toContain("cart-10");
    expect(newly).not.toContain("any-25");
    expect(newly).not.toContain("levels-100");
  });

  it("unlocks any-level and total-level milestones", () => {
    const specialist = createInitialState({ upgrades: { jackhammer: 25 } });
    const a = evaluateAchievements(specialist);
    expect(a).toContain("any-25");
    expect(a).not.toContain("any-50");
    expect(a).not.toContain("levels-100");

    const century = createInitialState({
      upgrades: { shovel: 50, pickaxe: 20, cart: 30 },
    });
    const b = evaluateAchievements(century);
    expect(b).toContain("any-50");
    expect(b).toContain("levels-100");
  });

  it("unlocks museum when all discoveries are owned", () => {
    const state = createInitialState({
      discoveries: {
        unlocked: DISCOVERY_DEFS.map((d) => d.id),
        worldSeed: 1,
        digRollMeter: 0,
      },
    });
    expect(evaluateAchievements(state)).toContain("museum");
  });

  it("requires afk and overnight flags", () => {
    const state = createInitialState({ depth: 1, upgrades: { cart: 1 } });
    evaluateAchievements(state);
    expect(state.achievements.unlocked).not.toContain("afk-digger");
    expect(state.achievements.unlocked).not.toContain("overnight");
    noteAfkDig(state);
    noteOvernightClaim(state);
    const newly = evaluateAchievements(state);
    expect(newly).toContain("afk-digger");
    expect(newly).toContain("overnight");
  });

  it("unlocks mineshaft and cart sighting achievements", () => {
    const state = createInitialState({ depth: 100 });
    evaluateAchievements(state);
    expect(state.achievements.unlocked).not.toContain("first-mineshaft");
    noteMineshaftSeen(state);
    expect(evaluateAchievements(state)).toContain("first-mineshaft");
    noteMinecartsSeen(state, ["0:1", "1:-1", "2:1"]);
    expect(evaluateAchievements(state)).toContain("carts-3");
    expect(evaluateAchievements(state)).not.toContain("carts-10");
    noteMinecartsSeen(state, [
      "3:1",
      "4:-1",
      "5:1",
      "6:-1",
      "7:1",
      "8:-1",
      "9:1",
    ]);
    expect(evaluateAchievements(state)).toContain("carts-10");
    // Re-seeing the same carts does not double-count.
    expect(noteMinecartsSeen(state, ["0:1", "1:-1"])).toBe(0);
  });
});
