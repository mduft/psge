/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import {
  applyLayerHardness,
  geoBoundaryWarp,
  geoLayerApproachDepths,
  geoLayerAt,
  geoPaletteTint,
  geoSkyColor,
  hardnessAt,
  wallAccentAt,
} from "../src/geoLayers.js";
import { softDigAmount } from "../src/softDig.js";
import { createInitialState, dig } from "../src/gameState.js";

describe("geoLayerAt", () => {
  it("names the early kilometer bands", () => {
    expect(geoLayerAt(0).id).toBe("soil");
    expect(geoLayerAt(999).name).toBe("Topsoil");
    expect(geoLayerAt(1000).id).toBe("clay");
    expect(geoLayerAt(1000).name).toBe("Packed clay");
    expect(geoLayerAt(5000).id).toBe("bedrock");
    expect(geoLayerAt(20_000).id).toBe("deep_crust");
    expect(geoLayerAt(50_000).id).toBe("ancient");
    expect(geoLayerAt(150_000).id).toBe("abyss");
  });

  it("keeps 4-neighbor geo warp within one meter step", () => {
    let maxStep = 0;
    for (let x = -40; x <= 40; x++) {
      for (let z = -40; z <= 0; z++) {
        const w = geoBoundaryWarp(x, z);
        maxStep = Math.max(
          maxStep,
          Math.abs(w - geoBoundaryWarp(x + 1, z)),
          Math.abs(w - geoBoundaryWarp(x, z + 1)),
        );
      }
    }
    expect(maxStep).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe("hardnessAt", () => {
  it("slows dig in deeper layers", () => {
    expect(hardnessAt(0)).toBe(1);
    expect(hardnessAt(2000)).toBe(0.72);
    expect(hardnessAt(8000)).toBe(0.48);
    expect(applyLayerHardness(1, 2000)).toBeCloseTo(0.72);
  });

  it("applies hardness after soft-cap on dig", () => {
    const surface = createInitialState({ upgrades: { shovel: 7 } });
    dig(surface);
    const deep = createInitialState({
      depth: 2000,
      upgrades: { shovel: 7 },
    });
    dig(deep);
    const soft = softDigAmount(0.25);
    expect(surface.depth.toNumber()).toBeCloseTo(soft);
    expect(deep.depth.toNumber() - 2000).toBeCloseTo(soft * 0.72);
  });
});

describe("layer fog ranges", () => {
  it("keeps fog inside the dig-camera frustum (~17–34)", () => {
    for (const depth of [0, 2_000, 8_000, 20_000, 50_000, 150_000]) {
      const { fogNear, fogFar } = geoLayerAt(depth).mood;
      expect(fogNear).toBeLessThan(fogFar);
      expect(fogFar).toBeLessThanOrEqual(60);
      expect(fogNear).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("geoLayerApproachDepths", () => {
  it("lands 5 m above each seam still in the prior layer", () => {
    const jumps = geoLayerApproachDepths(5);
    expect(jumps.map((j) => j.depth)).toEqual([
      995, 3_995, 11_995, 39_995, 119_995,
    ]);
    expect(geoLayerAt(995).id).toBe("soil");
    expect(geoLayerAt(1_000).id).toBe("clay");
    expect(geoLayerAt(119_995).id).not.toBe("abyss");
    expect(geoLayerAt(120_000).id).toBe("abyss");
  });
});

describe("wallAccentAt", () => {
  it("places iron in deep crust, gems in ancient, lava in the abyss", () => {
    let irons = 0;
    let gems = 0;
    let lavas = 0;
    for (let x = -16; x <= 16; x++) {
      for (const z of [-2] as const) {
        for (let y = -20_000; y >= -20_040; y--) {
          if (wallAccentAt(x, y, z) === "iron") irons += 1;
        }
        for (let y = -50_000; y >= -50_040; y--) {
          if (wallAccentAt(x, y, z) === "gem") gems += 1;
        }
        for (let y = -130_000; y >= -130_040; y--) {
          if (wallAccentAt(x, y, z) === "lava") lavas += 1;
        }
      }
    }
    expect(irons).toBeGreaterThan(0);
    expect(gems).toBeGreaterThan(0);
    expect(lavas).toBeGreaterThan(0);
    expect(wallAccentAt(0, -10, 0)).toBeNull();
  });

  it("never accents the dig-shaft footprint even in the abyss", () => {
    let shaftLava = 0;
    for (const x of [-1, 0]) {
      for (const z of [-1, 0]) {
        for (let y = -130_000; y >= -130_200; y--) {
          if (wallAccentAt(x, y, z) === "lava") shaftLava += 1;
        }
      }
    }
    expect(shaftLava).toBe(0);
  });
});

describe("geo visual helpers", () => {
  it("keeps abyss palette/sky on the geo-layer source of truth", () => {
    const abyss = geoLayerAt(150_000);
    expect(geoPaletteTint("abyss")).toEqual(abyss.paletteTint);
    expect(geoSkyColor("abyss")).toBe(abyss.mood.sky);
  });
});
