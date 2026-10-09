/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_DIG_POWER } from "../src/upgrades.js";
import {
  SOFT_DIG_SCALE,
  focusForDepth,
  softDigAmount,
} from "../src/softDig.js";

describe("softDigAmount", () => {
  it("keeps base dig power ~full strength", () => {
    const p1 = DEFAULT_DIG_POWER;
    expect(softDigAmount(p1)).toBeCloseTo(p1, 3);
  });

  it("keeps dig power 2 ~linear", () => {
    const p2 = 2 * DEFAULT_DIG_POWER;
    expect(softDigAmount(p2) / p2).toBeGreaterThan(0.95);
  });

  it("keeps a single dig crew nearly full strength", () => {
    const crew = 3;
    expect(softDigAmount(crew) / crew).toBeGreaterThan(0.75);
  });

  it("still soft-caps very high passive rates", () => {
    const crewHeavy = 30;
    expect(softDigAmount(crewHeavy)).toBeLessThan(crewHeavy);
    expect(softDigAmount(crewHeavy)).toBeGreaterThan(SOFT_DIG_SCALE);
  });

  it("is monotonic in raw power", () => {
    let prev = 0;
    for (const p of [0, 1 / 32, 2 / 32, 8 / 32, 0.5, 3, 30]) {
      const v = softDigAmount(p);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("clamps non-positive / non-finite", () => {
    expect(softDigAmount(0)).toBe(0);
    expect(softDigAmount(-1)).toBe(0);
    expect(softDigAmount(Number.NaN)).toBe(0);
  });
});

describe("focusForDepth", () => {
  it("sits slightly above the dig face", () => {
    expect(focusForDepth(0)).toBeCloseTo(0.35);
    expect(focusForDepth(10)).toBeCloseTo(-9.65);
  });
});
