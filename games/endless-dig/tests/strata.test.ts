/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import {
  boundaryWarp,
  layerWarp,
  roundWorldExtentUp,
  strataAt,
  WORLD_EXTENT_GROW_STEP,
} from "../src/world.js";

const SAMPLE_PROFILES = [
  { cell: 6, amp: 2.5, seed: 0x11a3 },
  { cell: 11, amp: 4, seed: 0x22b7 },
  { cell: 9, amp: 3.5, seed: 0x33c1 },
] as const;

describe("boundaryWarp", () => {
  it("keeps 4-neighbor steps within one block for each contact", () => {
    for (const profile of SAMPLE_PROFILES) {
      let maxStep = 0;
      for (let x = -40; x <= 40; x++) {
        for (let z = -40; z <= 0; z++) {
          const w = boundaryWarp(x, z, profile);
          maxStep = Math.max(
            maxStep,
            Math.abs(w - boundaryWarp(x + 1, z, profile)),
            Math.abs(w - boundaryWarp(x, z + 1, profile)),
          );
        }
      }
      expect(maxStep).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("gives contacts distinct shapes (not a shared curve)", () => {
    let nearEqual = 0;
    let samples = 0;
    const [a, b, c] = SAMPLE_PROFILES;
    for (let x = -32; x <= 32; x++) {
      for (let z = -32; z <= 0; z++) {
        const wa = boundaryWarp(x, z, a);
        const wb = boundaryWarp(x, z, b);
        const wc = boundaryWarp(x, z, c);
        samples++;
        if (Math.abs(wa - wb) < 0.08 && Math.abs(wb - wc) < 0.08) {
          nearEqual++;
        }
      }
    }
    expect(nearEqual / samples).toBeLessThan(0.15);
  });

  it("allows multi-block total undulation on a contact", () => {
    const profile = SAMPLE_PROFILES[1];
    let min = Infinity;
    let max = -Infinity;
    for (let x = -64; x <= 64; x++) {
      for (let z = -64; z <= 0; z++) {
        const w = boundaryWarp(x, z, profile);
        min = Math.min(min, w);
        max = Math.max(max, w);
      }
    }
    expect(max - min).toBeGreaterThan(1);
    expect(layerWarp(0, 0)).toBeTypeOf("number");
  });
});

describe("strataAt", () => {
  it("still stacks dirt near the surface and stone below", () => {
    expect(strataAt(0, 0, 0)).toBe("dirt");
    expect(strataAt(0, -20, 0)).not.toBe("dirt");
  });

  it("always returns a concrete BlockId (no holes under warp)", () => {
    const ids = new Set([
      "dirt",
      "stone",
      "granite",
      "deepslate",
      "cobble",
    ]);
    for (let x = -16; x <= 16; x++) {
      for (let z = -16; z <= 0; z++) {
        for (let y = -48; y <= 2; y++) {
          expect(ids.has(strataAt(x, y, z))).toBe(true);
        }
      }
    }
  });

  it("does not open a 2+ block material cliff between 4-neighbors", () => {
    for (let x = -24; x <= 24; x++) {
      for (let z = -16; z <= 0; z++) {
        for (let y = -40; y <= 0; y++) {
          const here = strataAt(x, y, z);
          const right = strataAt(x + 1, y, z);
          const forward = strataAt(x, y, z + 1);
          if (here !== right) {
            const up = strataAt(x, y + 1, z);
            const down = strataAt(x, y - 1, z);
            expect(
              right === up || right === down || right === here,
            ).toBe(true);
          }
          if (here !== forward) {
            const up = strataAt(x, y + 1, z);
            const down = strataAt(x, y - 1, z);
            expect(
              forward === up || forward === down || forward === here,
            ).toBe(true);
          }
        }
      }
    }
  });

  it("keeps cycling deep bands at km depth (O(1), not stuck on cobble)", () => {
    const ids = new Set<string>();
    for (let y = -50_000; y > -50_080; y--) {
      ids.add(strataAt(0, y, -1));
    }
    expect(ids.size).toBeGreaterThan(1);
    expect(ids.has("cobble") || ids.has("deepslate") || ids.has("stone")).toBe(
      true,
    );

    const t0 = performance.now();
    for (let i = 0; i < 20_000; i++) {
      strataAt(i % 17, -120_000 - (i % 64), -(i % 3));
    }
    expect(performance.now() - t0).toBeLessThan(100);
  });
});

describe("roundWorldExtentUp", () => {
  it("grows in coarse steps so digs do not expand every meter", () => {
    expect(roundWorldExtentUp(1000)).toBe(WORLD_EXTENT_GROW_STEP * 4);
    expect(roundWorldExtentUp(119_995 + 64)).toBeGreaterThan(119_995);
    expect(roundWorldExtentUp(256)).toBe(256);
    expect(roundWorldExtentUp(257)).toBe(512);
  });
});
