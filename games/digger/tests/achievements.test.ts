/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import {
  evaluateAchievements,
  noteAfkDig,
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
});
