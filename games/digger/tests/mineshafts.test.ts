/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import { isDigShaftCell } from "../src/digShaft.js";
import {
  isMineshaftAir,
  mineshaftCobwebChance,
  mineshaftFloorY,
  mineshaftHasCobweb,
  mineshaftCartDirtReward,
  mineshaftCrateX,
  mineshaftDecorStyle,
  mineshaftHasCrate,
  mineshaftHasMinecart,
  mineshaftHasTorch,
  mineshaftMinecartX,
  MINESHAFT_CRATE_CHANCE,
  MINESHAFT_MINECART_MAX_INSET,
  mineshaftMouthGap,
  mineshaftPlacement,
  mineshaftSides,
  mineshaftsInDepthRange,
  MINESHAFT_BAND_M,
  MINESHAFT_GAP_EXTRA_MAX,
  MINESHAFT_GAP_MIN,
  MINESHAFT_HEIGHT,
  MINESHAFT_JITTER_M,
  MINESHAFT_MINECART_CHANCE,
  MINESHAFT_START_M,
  MINESHAFT_WALL_HALF,
} from "../src/mineshafts.js";

describe("mineshaft bands", () => {
  it("spaces floors roughly every band with jitter", () => {
    const d0 = -mineshaftFloorY(0);
    const d1 = -mineshaftFloorY(1);
    expect(d0).toBeGreaterThanOrEqual(28);
    expect(d0).toBeLessThan(MINESHAFT_START_M + MINESHAFT_JITTER_M + 1);
    expect(d1 - d0).toBeGreaterThan(MINESHAFT_BAND_M - 2 * MINESHAFT_JITTER_M - 5);
    expect(d1 - d0).toBeLessThan(MINESHAFT_BAND_M + 2 * MINESHAFT_JITTER_M + 5);
  });

  it("picks at least one side per band", () => {
    for (let b = 0; b < 20; b++) {
      const sides = mineshaftSides(b);
      expect(sides.length).toBeGreaterThanOrEqual(1);
      expect(sides.length).toBeLessThanOrEqual(2);
    }
  });

  it("lists shafts inside a depth window", () => {
    const list = mineshaftsInDepthRange(0, 2_000);
    expect(list.length).toBeGreaterThan(0);
    for (const m of list) {
      expect(m.depthM).toBeGreaterThanOrEqual(0);
      expect(m.depthM).toBeLessThanOrEqual(2_000);
      expect(m.xMax).toBeGreaterThanOrEqual(m.xMin);
    }
  });
});

describe("isMineshaftAir", () => {
  it("carves a 3-high corridor on the placement side", () => {
    const m = mineshaftPlacement(0, mineshaftSides(0)[0]!);
    const midX = Math.floor((m.xMin + m.xMax) / 2);
    expect(isMineshaftAir(midX, m.floorY, -1)).toBe(true);
    expect(isMineshaftAir(midX, m.floorY + 1, 0)).toBe(true);
    // Back wall (z=-2) stays solid, same as the dig shaft.
    expect(isMineshaftAir(midX, m.floorY + MINESHAFT_HEIGHT - 1, -2)).toBe(
      false,
    );
    expect(isMineshaftAir(midX, m.floorY + MINESHAFT_HEIGHT, -1)).toBe(false);
    expect(isMineshaftAir(midX, m.floorY - 1, -1)).toBe(false);
  });

  it("never carves dig-shaft cells", () => {
    for (const x of [-1, 0]) {
      for (const z of [-1, 0]) {
        expect(isDigShaftCell(x, z)).toBe(true);
        for (let y = -500; y > -520; y--) {
          expect(isMineshaftAir(x, y, z)).toBe(false);
        }
      }
    }
  });

  it("stays within the wall strip", () => {
    const m = mineshaftPlacement(1, 1);
    expect(isMineshaftAir(MINESHAFT_WALL_HALF + 1, m.floorY, -1)).toBe(false);
    expect(isMineshaftAir(0, m.floorY, -1)).toBe(false);
  });

  it("stops at least one block shy of the dig shaft", () => {
    for (let b = 0; b < 40; b++) {
      for (const side of mineshaftSides(b) as (-1 | 1)[]) {
        const gap = mineshaftMouthGap(b, side);
        expect(gap).toBeGreaterThanOrEqual(MINESHAFT_GAP_MIN);
        expect(gap).toBeLessThanOrEqual(MINESHAFT_GAP_MIN + MINESHAFT_GAP_EXTRA_MAX);
        const m = mineshaftPlacement(b, side);
        if (side < 0) {
          expect(m.xMax).toBe(-1 - 1 - gap);
          // Buffer column(s) + dig shaft stay solid.
          for (let x = -1 - gap; x <= -1; x++) {
            expect(isMineshaftAir(x, m.floorY, -1)).toBe(false);
          }
          expect(isMineshaftAir(m.xMax, m.floorY, -1)).toBe(true);
        } else {
          expect(m.xMin).toBe(0 + 1 + gap);
          for (let x = 0; x <= gap; x++) {
            expect(isMineshaftAir(x, m.floorY, -1)).toBe(false);
          }
          expect(isMineshaftAir(m.xMin, m.floorY, -1)).toBe(true);
        }
      }
    }
  });
});

describe("cobwebs", () => {
  it("grows denser with depth but stays capped", () => {
    expect(mineshaftCobwebChance(100)).toBeLessThan(mineshaftCobwebChance(4_000));
    expect(mineshaftCobwebChance(100_000)).toBeLessThanOrEqual(0.62);
  });

  it("is deterministic per cell", () => {
    const a = mineshaftHasCobweb(5, -200, 1);
    const b = mineshaftHasCobweb(5, -200, 1);
    expect(a).toBe(b);
  });
});

describe("minecarts", () => {
  it("selects about a quarter of band/side pairs", () => {
    let hits = 0;
    let total = 0;
    for (let b = 0; b < 200; b++) {
      for (const side of [-1, 1] as const) {
        total++;
        if (mineshaftHasMinecart(b, side)) hits++;
      }
    }
    const rate = hits / total;
    expect(rate).toBeGreaterThan(MINESHAFT_MINECART_CHANCE - 0.1);
    expect(rate).toBeLessThan(MINESHAFT_MINECART_CHANCE + 0.1);
  });

  it("is deterministic per band/side", () => {
    expect(mineshaftHasMinecart(3, 1)).toBe(mineshaftHasMinecart(3, 1));
    expect(mineshaftMinecartX(3, 1, 2, 10)).toBe(mineshaftMinecartX(3, 1, 2, 10));
  });

  it("places cart at the mouth or at most a few blocks in", () => {
    let placed = 0;
    for (let b = 0; b < 80; b++) {
      for (const side of mineshaftSides(b) as (-1 | 1)[]) {
        if (!mineshaftHasMinecart(b, side)) continue;
        const m = mineshaftPlacement(b, side);
        const x = mineshaftMinecartX(b, side, m.xMin, m.xMax);
        const mouthX = side < 0 ? m.xMax : m.xMin;
        const inset = Math.abs(x - mouthX);
        expect(inset).toBeLessThanOrEqual(MINESHAFT_MINECART_MAX_INSET);
        expect(x).toBeGreaterThanOrEqual(m.xMin);
        expect(x).toBeLessThanOrEqual(m.xMax);
        expect(isMineshaftAir(x, m.floorY, -1)).toBe(true);
        placed++;
      }
    }
    expect(placed).toBeGreaterThan(0);
  });
});

describe("crates and décor", () => {
  it("selects about a quarter of shafts for crates", () => {
    let hits = 0;
    let total = 0;
    for (let b = 0; b < 200; b++) {
      for (const side of [-1, 1] as const) {
        total++;
        if (mineshaftHasCrate(b, side)) hits++;
      }
    }
    const rate = hits / total;
    expect(rate).toBeGreaterThan(MINESHAFT_CRATE_CHANCE - 0.1);
    expect(rate).toBeLessThan(MINESHAFT_CRATE_CHANCE + 0.1);
  });

  it("places crates near the mouth", () => {
    for (let b = 0; b < 40; b++) {
      for (const side of mineshaftSides(b) as (-1 | 1)[]) {
        if (!mineshaftHasCrate(b, side)) continue;
        const m = mineshaftPlacement(b, side);
        const x = mineshaftCrateX(b, side, m.xMin, m.xMax);
        const mouthX = side < 0 ? m.xMax : m.xMin;
        expect(Math.abs(x - mouthX)).toBeLessThanOrEqual(
          MINESHAFT_MINECART_MAX_INSET,
        );
      }
    }
  });

  it("switches décor style at bedrock depths", () => {
    expect(mineshaftDecorStyle(100)).toBe("wood");
    expect(mineshaftDecorStyle(4_000)).toBe("iron");
  });

  it("places some torches near the mouth", () => {
    let torches = 0;
    for (let b = 0; b < 20; b++) {
      const m = mineshaftPlacement(b, mineshaftSides(b)[0]!);
      const mouthX = m.side < 0 ? m.xMax : m.xMin;
      for (let x = m.xMin; x <= m.xMax; x++) {
        if (mineshaftHasTorch(x, m.floorY, m.side, mouthX)) torches++;
      }
    }
    expect(torches).toBeGreaterThan(0);
  });

  it("scales cart dirt rewards with depth", () => {
    expect(mineshaftCartDirtReward(50)).toBeGreaterThanOrEqual(1000);
    expect(mineshaftCartDirtReward(10_000)).toBeGreaterThan(
      mineshaftCartDirtReward(50),
    );
    expect(mineshaftCartDirtReward(1_000_000)).toBeLessThanOrEqual(50_000);
  });
});
