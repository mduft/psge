/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/gameState.js";
import {
  hasUnseen,
  markPanelTabSeen,
  markUnlockedSeen,
  panelSeenFromUnlocked,
} from "../src/panelSeen.js";

describe("panelSeen", () => {
  it("hasUnseen is false when nothing unlocked", () => {
    expect(hasUnseen([], [])).toBe(false);
    expect(hasUnseen([], ["a"])).toBe(false);
  });

  it("hasUnseen detects ids not yet viewed", () => {
    expect(hasUnseen(["a", "b"], ["a"])).toBe(true);
    expect(hasUnseen(["a", "b"], ["a", "b"])).toBe(false);
  });

  it("markUnlockedSeen syncs and reports change", () => {
    const seen: string[] = [];
    expect(markUnlockedSeen(["bone"], seen)).toBe(true);
    expect(seen).toEqual(["bone"]);
    expect(markUnlockedSeen(["bone"], seen)).toBe(false);
    expect(markUnlockedSeen(["bone", "fossil"], seen)).toBe(true);
    expect(seen).toEqual(["bone", "fossil"]);
  });

  it("markPanelTabSeen updates the matching catalog", () => {
    const state = createInitialState({
      discoveries: { unlocked: ["bone_shard"], worldSeed: 1, digRollMeter: 0 },
      specialCoins: { unlocked: ["copper_bit"] },
      achievements: {
        unlocked: ["first-dig"],
        afkDigSeen: false,
        overnightClaimed: false,
      },
    });
    expect(markPanelTabSeen(state, "shop")).toBe(false);
    expect(markPanelTabSeen(state, "collection")).toBe(true);
    expect(state.panelSeen.discoveries).toEqual(["bone_shard"]);
    expect(hasUnseen(state.discoveries.unlocked, state.panelSeen.discoveries)).toBe(
      false,
    );
    expect(markPanelTabSeen(state, "coins")).toBe(true);
    expect(state.panelSeen.specialCoins).toEqual(["copper_bit"]);
    expect(markPanelTabSeen(state, "achievements")).toBe(true);
    expect(state.panelSeen.achievements).toEqual(["first-dig"]);
  });

  it("panelSeenFromUnlocked copies all catalogs", () => {
    expect(
      panelSeenFromUnlocked({
        discoveries: { unlocked: ["a"] },
        specialCoins: { unlocked: ["b"] },
        achievements: { unlocked: ["c"] },
      }),
    ).toEqual({
      discoveries: ["a"],
      specialCoins: ["b"],
      achievements: ["c"],
    });
  });
});
