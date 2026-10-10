/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import {
  BOOSTER_AUTO_GRACE_M,
  BOOSTER_SPACING_MAX,
  BOOSTER_SPACING_MIN,
  BOOSTER_VALUES,
  claimAutoBoosters,
  claimTapBooster,
  emptyBoosterProgress,
  generateBoosters,
  rollBoosterValue,
  valueWeightsAtDepth,
  visibleBoosters,
} from "../src/boosters.js";

describe("generateBoosters", () => {
  it("is deterministic for the same seed", () => {
    const a = generateBoosters(42, 500);
    const b = generateBoosters(42, 500);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(5);
  });

  it("spaces coins on average between 25 and 50 m", () => {
    const list = generateBoosters(99, 5000);
    expect(list.length).toBeGreaterThan(50);
    const gaps: number[] = [];
    for (let i = 1; i < list.length; i++) {
      gaps.push(list[i]!.depth - list[i - 1]!.depth);
    }
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    expect(mean).toBeGreaterThanOrEqual(BOOSTER_SPACING_MIN - 1);
    expect(mean).toBeLessThanOrEqual(BOOSTER_SPACING_MAX + 1);
    for (const g of gaps) {
      expect(g).toBeGreaterThanOrEqual(BOOSTER_SPACING_MIN - 0.01);
      expect(g).toBeLessThanOrEqual(BOOSTER_SPACING_MAX + 0.01);
    }
  });

  it("only uses catalog dirt values", () => {
    for (const b of generateBoosters(7, 2000)) {
      expect(BOOSTER_VALUES).toContain(b.value);
    }
  });
});

describe("valueWeightsAtDepth", () => {
  it("shifts probability mass toward higher values with depth", () => {
    const shallow = valueWeightsAtDepth(50);
    const deep = valueWeightsAtDepth(20_000);
    expect(shallow[0]! + shallow[1]!).toBeGreaterThan(deep[0]! + deep[1]!);
    expect(deep[2]! + deep[3]!).toBeGreaterThan(shallow[2]! + shallow[3]!);
  });

  it("rollBoosterValue is biased by depth over many samples", () => {
    let shallowHigh = 0;
    let deepHigh = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      let s = (i * 1103515245 + 12345) >>> 0;
      const next = (): number => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
      };
      if (rollBoosterValue(next, 40) >= 200) shallowHigh++;
      if (rollBoosterValue(next, 25_000) >= 200) deepHigh++;
    }
    expect(deepHigh).toBeGreaterThan(shallowHigh);
  });
});

describe("claim rules", () => {
  it("auto-claims at 1× after grace and does not double-claim", () => {
    const progress = emptyBoosterProgress();
    const list = generateBoosters(11, 200);
    const first = list[0]!;
    const depth = first.depth + BOOSTER_AUTO_GRACE_M;
    const claims = claimAutoBoosters(progress, 11, depth);
    expect(claims.some((c) => c.id === first.id)).toBe(true);
    const hit = claims.find((c) => c.id === first.id)!;
    expect(hit.dirt).toBe(hit.value);
    expect(hit.via).toBe("auto");
    expect(progress.claimed.length).toBe(claims.length);
    expect(progress.dirtEarned).toBe(
      claims.reduce((s, c) => s + c.dirt, 0),
    );
    expect(claimAutoBoosters(progress, 11, depth)).toEqual([]);
  });

  it("tap claims at 2× while visible and within grace", () => {
    const progress = emptyBoosterProgress();
    const list = generateBoosters(11, 200);
    const first = list[0]!;
    const depth = first.depth + 0.5;
    const claim = claimTapBooster(progress, 11, depth, first.id);
    expect(claim).not.toBeNull();
    expect(claim!.dirt).toBe(first.value * 2);
    expect(claim!.via).toBe("tap");
    expect(progress.dirtEarned).toBe(first.value * 2);
    expect(progress.claimed).toEqual([first.id]);
    expect(claimTapBooster(progress, 11, depth, first.id)).toBeNull();
  });

  it("rejects tap after grace has closed", () => {
    const progress = emptyBoosterProgress();
    const list = generateBoosters(11, 200);
    const first = list[0]!;
    const depth = first.depth + BOOSTER_AUTO_GRACE_M + 0.1;
    expect(claimTapBooster(progress, 11, depth, first.id)).toBeNull();
  });

  it("visibleBoosters only lists unclaimed in-window coins", () => {
    const progress = emptyBoosterProgress();
    const list = generateBoosters(3, 300);
    const first = list[0]!;
    const depth = first.depth + 1;
    const visible = visibleBoosters(progress, 3, depth);
    expect(visible.some((b) => b.id === first.id)).toBe(true);
    claimTapBooster(progress, 3, depth, first.id);
    expect(visibleBoosters(progress, 3, depth).some((b) => b.id === first.id)).toBe(
      false,
    );
  });
});
