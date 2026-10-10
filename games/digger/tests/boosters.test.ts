/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import {
  BOOSTER_AUTO_GRACE_M,
  BOOSTER_COMBO_CAP,
  BOOSTER_COMBO_TIMEOUT_MS,
  BOOSTER_SPACING_MAX,
  BOOSTER_SPACING_MIN,
  BOOSTER_TAP_DEPTH_BASE,
  BOOSTER_VALUES,
  boosterComboMult,
  boosterTapDepthMult,
  boosterTapDirt,
  claimAutoBoosters,
  claimTapBooster,
  emptyBoosterProgress,
  expireBoosterCombo,
  generateBoosters,
  normalizeBoosterProgress,
  noteBoosterComboTap,
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

describe("tap depth and combo mult", () => {
  it("depth mult starts near base and grows with depth", () => {
    expect(boosterTapDepthMult(0)).toBeCloseTo(BOOSTER_TAP_DEPTH_BASE, 5);
    expect(boosterTapDepthMult(2500)).toBeGreaterThan(boosterTapDepthMult(50));
    expect(boosterTapDepthMult(20_000)).toBeGreaterThan(
      boosterTapDepthMult(2500),
    );
    expect(boosterTapDepthMult(1_000_000)).toBeLessThanOrEqual(
      BOOSTER_TAP_DEPTH_BASE + 3 + 1e-9,
    );
  });

  it("combo mult steps then caps", () => {
    expect(boosterComboMult(1)).toBe(1);
    expect(boosterComboMult(2)).toBeCloseTo(1.25, 5);
    expect(boosterComboMult(5)).toBeCloseTo(2, 5);
    expect(boosterComboMult(9)).toBe(BOOSTER_COMBO_CAP);
    expect(boosterComboMult(99)).toBe(BOOSTER_COMBO_CAP);
  });

  it("boosterTapDirt multiplies value by depth and combo", () => {
    const shallow = boosterTapDirt(100, 20, 1);
    expect(shallow.dirt).toBe(Math.floor(100 * shallow.mult));
    expect(shallow.mult).toBeCloseTo(shallow.depthMult * shallow.comboMult, 8);
    expect(shallow.dirt).toBeGreaterThanOrEqual(190);
    expect(shallow.dirt).toBeLessThanOrEqual(210);

    const combo = boosterTapDirt(100, 20, 5);
    expect(combo.dirt).toBeGreaterThan(shallow.dirt);

    const deep = boosterTapDirt(100, 20_000, 1);
    expect(deep.dirt).toBeGreaterThan(shallow.dirt);
  });

  it("persisted combo survives normalize within timeout and expires after", () => {
    const now = 1_700_000_000_000;
    const live = normalizeBoosterProgress(
      { claimed: [], dirtEarned: 0, combo: 5, comboAtMs: now - 10_000 },
      now,
    );
    expect(live.combo).toBe(5);
    expect(live.comboAtMs).toBe(now - 10_000);

    const stale = normalizeBoosterProgress(
      {
        claimed: [],
        dirtEarned: 0,
        combo: 5,
        comboAtMs: now - BOOSTER_COMBO_TIMEOUT_MS - 1,
      },
      now,
    );
    expect(stale.combo).toBe(0);
    expect(stale.comboAtMs).toBe(0);
  });

  it("note/expire helpers update streak timestamps", () => {
    const p = emptyBoosterProgress();
    noteBoosterComboTap(p, 3, 1000);
    expect(p.combo).toBe(3);
    expect(p.comboAtMs).toBe(1000);
    expect(expireBoosterCombo(p, 1000 + BOOSTER_COMBO_TIMEOUT_MS)).toBe(false);
    expect(p.combo).toBe(3);
    expect(expireBoosterCombo(p, 1000 + BOOSTER_COMBO_TIMEOUT_MS + 1)).toBe(
      true,
    );
    expect(p.combo).toBe(0);
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
    expect(hit.combo).toBeUndefined();
    expect(progress.claimed.length).toBe(claims.length);
    expect(progress.dirtEarned).toBe(
      claims.reduce((s, c) => s + c.dirt, 0),
    );
    expect(claimAutoBoosters(progress, 11, depth)).toEqual([]);
  });

  it("tap claims with depth×combo mult while visible and within grace", () => {
    const progress = emptyBoosterProgress();
    const list = generateBoosters(11, 200);
    const first = list[0]!;
    const depth = first.depth + 0.5;
    const expected = boosterTapDirt(first.value, first.depth, 1);
    const claim = claimTapBooster(progress, 11, depth, first.id, 1);
    expect(claim).not.toBeNull();
    expect(claim!.dirt).toBe(expected.dirt);
    expect(claim!.via).toBe("tap");
    expect(claim!.combo).toBe(1);
    expect(claim!.mult).toBeCloseTo(expected.mult, 8);
    expect(progress.dirtEarned).toBe(expected.dirt);
    expect(progress.claimed).toEqual([first.id]);
    expect(claimTapBooster(progress, 11, depth, first.id, 2)).toBeNull();
  });

  it("higher combo streak pays more on tap", () => {
    const list = generateBoosters(11, 200);
    const first = list[0]!;
    const depth = first.depth + 0.5;
    const a = emptyBoosterProgress();
    const b = emptyBoosterProgress();
    const low = claimTapBooster(a, 11, depth, first.id, 1)!;
    const high = claimTapBooster(b, 11, depth, first.id, 5)!;
    expect(high.dirt).toBeGreaterThan(low.dirt);
    expect(high.combo).toBe(5);
  });

  it("rejects tap after grace has closed", () => {
    const progress = emptyBoosterProgress();
    const list = generateBoosters(11, 200);
    const first = list[0]!;
    const depth = first.depth + BOOSTER_AUTO_GRACE_M + 0.1;
    expect(claimTapBooster(progress, 11, depth, first.id, 1)).toBeNull();
  });

  it("visibleBoosters only lists unclaimed in-window coins", () => {
    const progress = emptyBoosterProgress();
    const list = generateBoosters(3, 300);
    const first = list[0]!;
    const depth = first.depth + 1;
    const visible = visibleBoosters(progress, 3, depth);
    expect(visible.some((b) => b.id === first.id)).toBe(true);
    claimTapBooster(progress, 3, depth, first.id, 1);
    expect(visibleBoosters(progress, 3, depth).some((b) => b.id === first.id)).toBe(
      false,
    );
  });
});
