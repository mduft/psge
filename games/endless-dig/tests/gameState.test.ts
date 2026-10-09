/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import {
  buyUpgrade,
  canBuyUpgrade,
  createInitialState,
  dig,
  digPowerOf,
  DEFAULT_DIG_POWER,
  passiveRateOf,
  SHAFT_CROSS_SECTION,
  tickProduction,
} from "../src/gameState.js";
import { upgradeCost } from "../src/upgrades.js";

describe("dig", () => {
  it("increases depth by digPower and dirt by cross-section", () => {
    // 15 shovels → dig power = 16/32 = 0.5
    const state = createInitialState({ upgrades: { shovel: 15 } });
    dig(state);
    expect(state.depth.toNumber()).toBeCloseTo(0.5);
    expect(state.dirt.toNumber()).toBeCloseTo(0.5 * SHAFT_CROSS_SECTION);
  });

  it("uses default dig power from createInitialState", () => {
    const state = createInitialState();
    dig(state);
    expect(state.depth.toNumber()).toBeCloseTo(DEFAULT_DIG_POWER);
  });

  it("caps depth at maxDepth", () => {
    // ~10 dig power via jackhammers
    const state = createInitialState({
      depth: 8,
      upgrades: { jackhammer: 20 },
    });
    dig(state, 10);
    expect(state.depth.toNumber()).toBe(10);
    expect(state.dirt.toNumber()).toBeCloseTo(2 * SHAFT_CROSS_SECTION);
  });

  it("is deterministic across many digs", () => {
    // 7 shovels → 8/32 = 0.25
    const state = createInitialState({ upgrades: { shovel: 7 } });
    for (let i = 0; i < 40; i++) dig(state);
    expect(state.depth.toNumber()).toBeCloseTo(10);
    expect(state.dirt.toNumber()).toBeCloseTo(10 * SHAFT_CROSS_SECTION);
  });
});

describe("upgrades", () => {
  it("derives dig power from shovel levels (first shovel doubles)", () => {
    const one = createInitialState({ upgrades: { shovel: 1 } });
    expect(digPowerOf(one).toNumber()).toBeCloseTo(2 * DEFAULT_DIG_POWER);
    const two = createInitialState({ upgrades: { shovel: 2 } });
    expect(digPowerOf(two).toNumber()).toBeCloseTo(3 * DEFAULT_DIG_POWER);
  });

  it("buys shovel when affordable and raises cost", () => {
    const state = createInitialState({ dirt: 100 });
    const first = upgradeCost("shovel", 0);
    expect(canBuyUpgrade(state, "shovel")).toBe(true);
    expect(buyUpgrade(state, "shovel")).toBe(true);
    expect(state.upgrades.shovel).toBe(1);
    expect(state.dirt.toNumber()).toBeCloseTo(100 - first.toNumber());
    expect(upgradeCost("shovel", 1).gt(first)).toBe(true);
  });

  it("rejects unaffordable buys", () => {
    const state = createInitialState({ dirt: 1 });
    expect(buyUpgrade(state, "shovel")).toBe(false);
    expect(state.upgrades.shovel).toBe(0);
  });
});

describe("tickProduction", () => {
  it("applies passive depth from cart", () => {
    const state = createInitialState({ upgrades: { cart: 1 } });
    expect(passiveRateOf(state).toNumber()).toBeCloseTo(0.05);
    expect(tickProduction(state, 2)).toBe(true);
    expect(state.depth.toNumber()).toBeCloseTo(0.1);
    expect(state.dirt.toNumber()).toBeCloseTo(0.1 * SHAFT_CROSS_SECTION);
  });

  it("no-ops without generators", () => {
    const state = createInitialState();
    expect(tickProduction(state, 1)).toBe(false);
    expect(state.depth.isZero()).toBe(true);
  });
});
