/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import {
  claimAutoSpecialCoins,
  claimTapSpecialCoin,
  emptySpecialCoinProgress,
  generateSpecialCoins,
  SPECIAL_COIN_COUNT,
  SPECIAL_COIN_DEFS,
  SPECIAL_SPACING_MIN,
  SPECIAL_TAP_PREMIUM_BASE,
  specialTapPremiumAtDepth,
  unlockNextSpecialCoin,
  visibleSpecialCoins,
} from "../src/specialCoins.js";
import { BOOSTER_AUTO_GRACE_M } from "../src/boosters.js";

describe("specialCoins", () => {
  it("catalog has exactly 20 unique ids", () => {
    expect(SPECIAL_COIN_DEFS).toHaveLength(SPECIAL_COIN_COUNT);
    const ids = new Set(SPECIAL_COIN_DEFS.map((d) => d.id));
    expect(ids.size).toBe(SPECIAL_COIN_COUNT);
  });

  it("generateSpecialCoins is deterministic and sparse", () => {
    const a = generateSpecialCoins(42);
    const b = generateSpecialCoins(42);
    expect(a).toEqual(b);
    expect(a).toHaveLength(SPECIAL_COIN_COUNT);
    for (let i = 1; i < a.length; i++) {
      expect(a[i]!.depth - a[i - 1]!.depth).toBeGreaterThanOrEqual(
        SPECIAL_SPACING_MIN - 0.001,
      );
    }
    expect(generateSpecialCoins(99)[0]!.depth).not.toBe(a[0]!.depth);
  });

  it("tap premium starts at base and grows with depth", () => {
    expect(specialTapPremiumAtDepth(0)).toBe(SPECIAL_TAP_PREMIUM_BASE);
    expect(specialTapPremiumAtDepth(80)).toBeGreaterThanOrEqual(
      SPECIAL_TAP_PREMIUM_BASE,
    );
    expect(specialTapPremiumAtDepth(5000)).toBeGreaterThan(
      specialTapPremiumAtDepth(500),
    );
    expect(specialTapPremiumAtDepth(20000)).toBeGreaterThan(
      specialTapPremiumAtDepth(5000),
    );
  });

  it("tap claims within grace with depth-scaled dirt; auto after grace", () => {
    const seed = 7;
    const coins = generateSpecialCoins(seed);
    const first = coins[0]!;
    const progress = emptySpecialCoinProgress();

    expect(
      claimTapSpecialCoin(progress, seed, first.depth - 1, first.id),
    ).toBeNull();

    const tap = claimTapSpecialCoin(progress, seed, first.depth, first.id);
    expect(tap).toEqual({
      id: first.id,
      dirt: specialTapPremiumAtDepth(first.depth),
      via: "tap",
    });
    expect(tap!.dirt).toBeGreaterThanOrEqual(SPECIAL_TAP_PREMIUM_BASE);
    expect(progress.unlocked).toEqual([first.id]);
    expect(
      claimTapSpecialCoin(progress, seed, first.depth, first.id),
    ).toBeNull();

    const second = coins[1]!;
    const autoDepth = second.depth + BOOSTER_AUTO_GRACE_M;
    const got = claimAutoSpecialCoins(
      emptySpecialCoinProgress(),
      seed,
      autoDepth,
    );
    expect(got.map((c) => c.id)).toContain(second.id);
    expect(got.map((c) => c.id)).toContain(first.id);
    expect(got.every((c) => c.via === "auto" && c.dirt === 0)).toBe(true);
  });

  it("visibleSpecialCoins hides owned and past-grace coins", () => {
    const seed = 3;
    const first = generateSpecialCoins(seed)[0]!;
    const progress = emptySpecialCoinProgress();
    const vis = visibleSpecialCoins(progress, seed, first.depth + 0.5);
    expect(vis.some((c) => c.id === first.id)).toBe(true);

    progress.unlocked.push(first.id);
    expect(
      visibleSpecialCoins(progress, seed, first.depth + 0.5).some(
        (c) => c.id === first.id,
      ),
    ).toBe(false);

    expect(
      visibleSpecialCoins(
        emptySpecialCoinProgress(),
        seed,
        first.depth + BOOSTER_AUTO_GRACE_M,
      ).some((c) => c.id === first.id),
    ).toBe(false);
  });

  it("unlockNextSpecialCoin walks the catalog", () => {
    const progress = emptySpecialCoinProgress();
    expect(unlockNextSpecialCoin(progress)).toBe(SPECIAL_COIN_DEFS[0]!.id);
    expect(unlockNextSpecialCoin(progress)).toBe(SPECIAL_COIN_DEFS[1]!.id);
    for (let i = 2; i < SPECIAL_COIN_COUNT; i++) {
      unlockNextSpecialCoin(progress);
    }
    expect(unlockNextSpecialCoin(progress)).toBeNull();
  });
});
