/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Mid-game save fixtures: migrations must never wipe depth / unlocks.
 */
import { describe, expect, it } from "vitest";
import { parseGameState, parseSaveVersion } from "../src/persist.js";

const richV9 = {
  version: 9 as number | string,
  depth: "12345.67",
  dirt: "99999",
  upgrades: { shovel: 3, pickaxe: 2, jackhammer: 1, cart: 1, drill: 0, crew: 0 },
  lastPlayedAtMs: 1_700_000_000_000,
  discoveries: {
    unlocked: ["bone_shard", "flint_flake"],
    worldSeed: 42,
    digRollMeter: 0.5,
  },
  boosters: { claimed: ["b0", "b1", "b2"], dirtEarned: 1500 },
  specialCoins: { unlocked: ["copper_bit"] },
  achievements: {
    unlocked: ["first-dig", "depth-100"],
    afkDigSeen: true,
    overnightClaimed: false,
  },
  panelSeen: {
    discoveries: ["bone_shard"],
    specialCoins: [],
    achievements: ["first-dig"],
  },
};

describe("parseSaveVersion", () => {
  it("accepts integer numbers and numeric strings", () => {
    expect(parseSaveVersion(9)).toBe(9);
    expect(parseSaveVersion("9")).toBe(9);
    expect(parseSaveVersion("10")).toBe(10);
    expect(parseSaveVersion(9.5)).toBeNull();
    expect(parseSaveVersion("nope")).toBeNull();
  });
});

describe("mid-game migration fidelity", () => {
  it("v9 → current keeps depth, dirt, upgrades, and catalogs", () => {
    const s = parseGameState(richV9);
    expect(s).not.toBeNull();
    expect(s!.version).toBe(11);
    expect(s!.autoDigPaused).toBe(false);
    expect(s!.depth.toString()).toBe("12345.67");
    expect(s!.dirt.toString()).toBe("99999");
    expect(s!.upgrades.shovel).toBe(3);
    expect(s!.upgrades.pickaxe).toBe(2);
    expect(s!.discoveries.unlocked).toEqual(["bone_shard", "flint_flake"]);
    expect(s!.discoveries.worldSeed).toBe(42);
    expect(s!.boosters.claimed).toEqual(["b0", "b1", "b2"]);
    expect(s!.boosters.dirtEarned).toBe(1500);
    expect(s!.boosters.combo).toBe(0);
    expect(s!.specialCoins.unlocked).toEqual(["copper_bit"]);
    expect(s!.achievements.unlocked).toEqual(["first-dig", "depth-100"]);
    expect(s!.panelSeen.discoveries).toEqual(["bone_shard"]);
  });

  it("keeps progress when dirt is zero", () => {
    const s = parseGameState({ ...richV9, dirt: "0" });
    expect(s).not.toBeNull();
    expect(s!.depth.toString()).toBe("12345.67");
    expect(s!.dirt.toString()).toBe("0");
  });

  it("accepts string version tags without wiping", () => {
    const s = parseGameState({ ...richV9, version: "9" });
    expect(s).not.toBeNull();
    expect(s!.depth.toString()).toBe("12345.67");
    expect(s!.upgrades.shovel).toBe(3);
  });

  it("v8 → current preserves depth through the chain", () => {
    const { panelSeen: _panelSeen, ...v8 } = richV9;
    const s = parseGameState({ ...v8, version: 8 });
    expect(s).not.toBeNull();
    expect(s!.depth.toString()).toBe("12345.67");
    expect(s!.dirt.toString()).toBe("99999");
    expect(s!.achievements.unlocked).toEqual(["first-dig", "depth-100"]);
  });

  it("v10 → current defaults autoDigPaused false", () => {
    const s = parseGameState({
      ...richV9,
      version: 10,
      boosters: {
        claimed: ["b0", "b1", "b2"],
        dirtEarned: 1500,
        combo: 2,
        comboAtMs: Date.now() - 1_000,
      },
    });
    expect(s).not.toBeNull();
    expect(s!.version).toBe(11);
    expect(s!.autoDigPaused).toBe(false);
    expect(s!.depth.toString()).toBe("12345.67");
    expect(s!.boosters.claimed).toEqual(["b0", "b1", "b2"]);
    expect(s!.boosters.combo).toBe(2);
  });
});
