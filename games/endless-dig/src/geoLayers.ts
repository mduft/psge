/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Kilometer-scale geological layers (M6). Separate from fine block strata mix.
 */
import { Color } from "three";

export type GeoLayerId =
  | "soil"
  | "clay"
  | "bedrock"
  | "deep_crust"
  | "ancient"
  | "abyss";

export interface GeoLayerMood {
  /** Scene background / fog base. */
  sky: number;
  /**
   * Linear fog in scene units (blocks × BLOCK_SCALE ≈ 1.55).
   * Dig camera sits ~17–34 units out — ranges must sit inside that frustum
   * or the cutaway never hazes.
   */
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  dirColor: number;
  dirIntensity: number;
}

export interface GeoLayerDef {
  id: GeoLayerId;
  name: string;
  /** Inclusive top depth (m). */
  top: number;
  /** Exclusive bottom depth (m); Infinity for endless abyss bands. */
  bottom: number;
  /** Multiplier on soft-capped dig after softDigAmount (1 = full strength). */
  hardness: number;
  mood: GeoLayerMood;
  /** Dig-chip colors (sRGB hex). */
  chipColors: readonly number[];
  /** HSL offset applied to fine block palettes in this layer. */
  paletteTint: { h: number; s: number; l: number };
}

/**
 * Named bands — first layer ~1 km, then expanding. Abyss repeats every 80 km
 * after 120 km with hardness floored at 0.12.
 */
export const GEO_LAYERS: readonly GeoLayerDef[] = [
  {
    id: "soil",
    name: "Topsoil",
    top: 0,
    bottom: 1_000,
    hardness: 1,
    mood: {
      sky: 0x87b7e0,
      // Soft far haze only — dig face stays clear.
      fogNear: 22,
      fogFar: 55,
      hemiSky: 0xe8f2ff,
      hemiGround: 0x4a3424,
      hemiIntensity: 0.85,
      dirColor: 0xfff2d8,
      dirIntensity: 1.25,
    },
    chipColors: [0x8b5a2b, 0x7a4e24, 0x6b4424, 0x9a7a55, 0x5a4a3a],
    paletteTint: { h: 0, s: 0, l: 0 },
  },
  {
    id: "clay",
    name: "Packed clay",
    top: 1_000,
    bottom: 4_000,
    hardness: 0.72,
    mood: {
      sky: 0xc4a882,
      fogNear: 20,
      fogFar: 50,
      hemiSky: 0xe8d4b8,
      hemiGround: 0x5a4030,
      hemiIntensity: 0.75,
      dirColor: 0xffe0b8,
      dirIntensity: 1.05,
    },
    chipColors: [0xa67c52, 0x8b6914, 0x6b4424, 0xb8956a, 0x7a5a3a],
    paletteTint: { h: 0.03, s: 0.06, l: -0.04 },
  },
  {
    id: "bedrock",
    name: "Bedrock",
    top: 4_000,
    bottom: 12_000,
    hardness: 0.48,
    mood: {
      sky: 0x6a7888,
      fogNear: 18,
      fogFar: 46,
      hemiSky: 0xb0c0d0,
      hemiGround: 0x3a4048,
      hemiIntensity: 0.65,
      dirColor: 0xd8e0e8,
      dirIntensity: 0.95,
    },
    chipColors: [0x8a8a8a, 0x6a6a6a, 0x9a6b5a, 0x5a5a5a, 0x7a7a7a],
    paletteTint: { h: -0.04, s: -0.12, l: -0.06 },
  },
  {
    id: "deep_crust",
    name: "Deep crust",
    top: 12_000,
    bottom: 40_000,
    hardness: 0.32,
    mood: {
      sky: 0x2a3848,
      fogNear: 15,
      fogFar: 40,
      hemiSky: 0x607888,
      hemiGround: 0x1e2430,
      hemiIntensity: 0.5,
      dirColor: 0x90a8c0,
      dirIntensity: 0.75,
    },
    chipColors: [0x3d4450, 0x5a6068, 0x2a3038, 0x6e6e6e, 0x484858],
    paletteTint: { h: -0.08, s: -0.18, l: -0.1 },
  },
  {
    id: "ancient",
    name: "Ancient rock",
    top: 40_000,
    bottom: 120_000,
    hardness: 0.22,
    mood: {
      // Teal haze — readable as a different biome, not just “darker grey”.
      sky: 0x0e2e2c,
      fogNear: 12,
      fogFar: 34,
      hemiSky: 0x3a8880,
      hemiGround: 0x0a221f,
      hemiIntensity: 0.55,
      dirColor: 0x60d0c0,
      dirIntensity: 0.65,
    },
    chipColors: [0x2a4a48, 0x3d5a55, 0x1a3030, 0x4a6860, 0x285048],
    paletteTint: { h: 0.12, s: -0.05, l: -0.1 },
  },
] as const;

const ABYSS_BAND = 80_000;
const ABYSS_HARDNESS_FLOOR = 0.12;
const ABYSS_BASE: Omit<GeoLayerDef, "top" | "bottom" | "hardness"> = {
  id: "abyss",
  name: "The Abyss",
  mood: {
    // Ember void — warm fog so depth still reads as a place, not a black void.
    sky: 0x14080c,
    fogNear: 9,
    fogFar: 28,
    hemiSky: 0x4a2030,
    hemiGround: 0x2a0c08,
    hemiIntensity: 0.5,
    dirColor: 0xff8040,
    dirIntensity: 0.45,
  },
  chipColors: [0x3a1810, 0x2a3040, 0x10141c, 0x5a2818, 0x0c1018],
  paletteTint: { h: -0.05, s: -0.15, l: -0.12 },
};

/** Horizontal warp so geo seams are not razor-flat (± tens of meters). */
const GEO_WARP_CELL = 64;
const GEO_WARP_AMP = 28;

function hash01(ix: number, iz: number, seed: number): number {
  let n =
    Math.imul(ix | 0, 374761393) +
    Math.imul(iz | 0, 668265263) +
    (seed | 0);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Lipschitz ≤ 1 depth offset for visual geo seams. */
export function geoBoundaryWarp(x: number, z: number): number {
  const fx = x / GEO_WARP_CELL;
  const fz = z / GEO_WARP_CELL;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = fx - x0;
  const tz = fz - z0;
  const amp = Math.min(GEO_WARP_AMP, GEO_WARP_CELL / 2);
  const v = (ix: number, iz: number) =>
    (hash01(ix, iz, 0x6e01a7) * 2 - 1) * amp;
  const a = v(x0, z0) + (v(x0 + 1, z0) - v(x0, z0)) * tx;
  const b = v(x0, z0 + 1) + (v(x0 + 1, z0 + 1) - v(x0, z0 + 1)) * tx;
  return a + (b - a) * tz;
}

function abyssLayer(depth: number): GeoLayerDef {
  const i = Math.max(0, Math.floor((depth - 120_000) / ABYSS_BAND));
  const top = 120_000 + i * ABYSS_BAND;
  const hardness = Math.max(
    ABYSS_HARDNESS_FLOOR,
    0.18 - i * 0.01,
  );
  return {
    ...ABYSS_BASE,
    top,
    bottom: top + ABYSS_BAND,
    hardness,
  };
}

function layerFromDepth(depth: number): GeoLayerDef {
  const d = Math.max(0, depth);
  for (const layer of GEO_LAYERS) {
    if (d >= layer.top && d < layer.bottom) return layer;
  }
  return abyssLayer(d);
}

/**
 * Geological layer at a shaft depth (meters down).
 * Pass x/z for visual seam warp; omit for gameplay (hardness).
 */
export function geoLayerAt(
  depth: number,
  x?: number,
  z?: number,
): GeoLayerDef {
  let d = Math.max(0, depth);
  if (x !== undefined && z !== undefined) {
    d = Math.max(0, d - geoBoundaryWarp(x, z));
  }
  return layerFromDepth(d);
}

/** Dig hardness at depth (no xz warp — fair across the shaft). */
export function hardnessAt(depth: number): number {
  return layerFromDepth(Math.max(0, depth)).hardness;
}

/** Apply soft-capped dig amount through layer hardness. */
export function applyLayerHardness(
  softAmount: number,
  depth: number,
): number {
  if (!(softAmount > 0) || !Number.isFinite(softAmount)) return 0;
  return softAmount * hardnessAt(depth);
}

export function chipColorsForDepth(depth: number): readonly number[] {
  return geoLayerAt(depth).chipColors;
}

/** Depths just above each layer seam (for debug jump buttons). */
export function geoLayerApproachDepths(
  beforeMeters = 5,
): readonly { id: GeoLayerId; name: string; depth: number }[] {
  const before = Math.max(0, beforeMeters);
  const out: { id: GeoLayerId; name: string; depth: number }[] = [];
  for (const layer of GEO_LAYERS) {
    if (layer.top <= 0) continue;
    out.push({
      id: layer.id,
      name: layer.name,
      depth: Math.max(0, layer.top - before),
    });
  }
  const abyssTop = GEO_LAYERS[GEO_LAYERS.length - 1]!.bottom;
  out.push({
    id: "abyss",
    name: ABYSS_BASE.name,
    depth: Math.max(0, abyssTop - before),
  });
  return out;
}

export function tintHex(
  hex: string,
  tint: { h: number; s: number; l: number },
): string {
  const c = new Color(hex);
  c.offsetHSL(tint.h, tint.s, tint.l);
  return `#${c.getHexString()}`;
}

/**
 * Sparse glowing accents on cutaway walls (never the dig shaft — see world).
 * Ancient → gem (often singles / pairs). Abyss → lava (runs of 1–3).
 */
export function wallAccentAt(
  x: number,
  y: number,
  z: number,
): "lava" | "gem" | null {
  if (y > -3) return null;
  const layer = geoLayerAt(Math.max(0, -y), x, z);
  if (layer.id === "abyss") {
    return inAccentRun(x, y, z, 0x1a7a00, 0.03, 3) ? "lava" : null;
  }
  if (layer.id === "ancient") {
    return inAccentRun(x, y, z, 0x6e1100, 0.02, 2) ? "gem" : null;
  }
  return null;
}

/** Pattern index for accent textures (stable per cell). */
export function wallAccentVariant(x: number, y: number, z: number): number {
  return Math.floor(hash01(x, y, z + 0xacc01) * 4);
}

/** True when (x,y,z) lies on a short seeded run along X, Y, or Z. */
function inAccentRun(
  x: number,
  y: number,
  z: number,
  seed: number,
  density: number,
  maxLen: number,
): boolean {
  const axes: Array<[number, number, number]> = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (const [dx, dy, dz] of axes) {
    for (let back = 0; back < maxLen; back++) {
      const sx = x - dx * back;
      const sy = y - dy * back;
      const sz = z - dz * back;
      const h = hash01(sx, sy, sz + seed);
      if (h >= density) continue;
      // Pick axis for this seed from a second hash so runs don't fire on all axes.
      const axisPick = Math.floor(hash01(sx, sy, sz + seed + 1) * 3);
      const axis = axes[axisPick]!;
      if (axis[0] !== dx || axis[1] !== dy || axis[2] !== dz) continue;
      const len =
        1 + Math.floor(hash01(sx, sy, sz + seed + 2) * maxLen);
      if (back < len) return true;
    }
  }
  return false;
}
