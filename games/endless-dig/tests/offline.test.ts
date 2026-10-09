/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import { createInitialState, SHAFT_CROSS_SECTION } from "../src/gameState.js";
import { softDigAmount } from "../src/softDig.js";
import {
  claimOfflineReward,
  computeHiddenCatchUp,
  computeOfflineReward,
  formatOfflineDuration,
  OFFLINE_EFFICIENCY,
  OFFLINE_MAX_MS,
  OFFLINE_MIN_MS,
} from "../src/offline.js";

describe("computeOfflineReward", () => {
  const now = 1_700_000_000_000;

  it("returns null without passive generators", () => {
    const state = createInitialState();
    expect(
      computeOfflineReward(state, now - 60_000, now),
    ).toBeNull();
  });

  it("returns null below the minimum away time", () => {
    const state = createInitialState({ upgrades: { cart: 1 } });
    expect(
      computeOfflineReward(state, now - (OFFLINE_MIN_MS - 1), now),
    ).toBeNull();
  });

  it("credits soft-capped rate × time × 1/6", () => {
    const state = createInitialState({ upgrades: { cart: 1 } });
    const elapsed = 120_000;
    const reward = computeOfflineReward(state, now - elapsed, now);
    expect(reward).not.toBeNull();
    const soft = softDigAmount(0.05);
    const expected = soft * (elapsed / 1000) * OFFLINE_EFFICIENCY;
    expect(reward!.depthGained.toNumber()).toBeCloseTo(expected, 8);
    expect(reward!.dirtGained.toNumber()).toBeCloseTo(
      expected * SHAFT_CROSS_SECTION,
      8,
    );
    expect(reward!.elapsedMs).toBe(elapsed);
  });

  it("caps credited time at 24h", () => {
    const state = createInitialState({ upgrades: { cart: 1 } });
    const raw = OFFLINE_MAX_MS + 3 * 60 * 60 * 1000;
    const reward = computeOfflineReward(state, now - raw, now);
    expect(reward!.elapsedMs).toBe(OFFLINE_MAX_MS);
    expect(reward!.rawElapsedMs).toBe(raw);
    const soft = softDigAmount(0.05);
    const expected =
      soft * (OFFLINE_MAX_MS / 1000) * OFFLINE_EFFICIENCY;
    expect(reward!.depthGained.toNumber()).toBeCloseTo(expected, 8);
  });

  it("is deterministic for the same inputs", () => {
    const state = createInitialState({ upgrades: { drill: 2 } });
    const a = computeOfflineReward(state, now - 3_600_000, now);
    const b = computeOfflineReward(state, now - 3_600_000, now);
    expect(a!.depthGained.eq(b!.depthGained)).toBe(true);
  });
});

describe("claimOfflineReward", () => {
  it("adds depth and dirt", () => {
    const state = createInitialState({ upgrades: { cart: 1 } });
    const reward = computeOfflineReward(
      state,
      1_000_000,
      1_000_000 + 120_000,
    )!;
    claimOfflineReward(state, reward);
    expect(state.depth.eq(reward.depthGained)).toBe(true);
    expect(state.dirt.eq(reward.dirtGained)).toBe(true);
  });
});

describe("computeHiddenCatchUp", () => {
  const now = 1_700_000_000_000;

  it("applies full soft rate for brief hides under the offline threshold", () => {
    const state = createInitialState({ upgrades: { cart: 1 } });
    const elapsed = 10_000;
    const catchUp = computeHiddenCatchUp(state, now - elapsed, now);
    expect(catchUp).not.toBeNull();
    const expected = softDigAmount(0.05) * (elapsed / 1000);
    expect(catchUp!.depthGained.toNumber()).toBeCloseTo(expected, 8);
  });

  it("returns null once the absence counts as offline", () => {
    const state = createInitialState({ upgrades: { cart: 1 } });
    expect(
      computeHiddenCatchUp(state, now - OFFLINE_MIN_MS, now),
    ).toBeNull();
  });
});

describe("formatOfflineDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatOfflineDuration(10.5 * 3600 * 1000)).toBe("10h 30m");
    expect(formatOfflineDuration(2 * 3600 * 1000)).toBe("2h");
    expect(formatOfflineDuration(90_000)).toBe("1m 30s");
    expect(formatOfflineDuration(4_000)).toBe("4s");
  });
});
