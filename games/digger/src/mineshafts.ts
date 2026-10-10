/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Abandoned side mineshafts: deterministic horizontal tunnels from the
 * cutaway walls toward the dig shaft (rails + cobwebs as mesh props).
 */
import { isDigShaftCell } from "./digShaft.js";

/** First band center depth (m) — early topsoil. */
export const MINESHAFT_START_M = 60;
/** Nominal spacing between successive shafts (m). */
export const MINESHAFT_BAND_M = 160;
/** Jitter amplitude around each band center (±m). */
export const MINESHAFT_JITTER_M = 35;
/** Interior height in blocks (floor air … ceiling air). */
export const MINESHAFT_HEIGHT = 3;
/** Match `world.ts` cutaway strip. */
export const MINESHAFT_WALL_HALF = 16;
/**
 * Interior Z matches the dig shaft (`digShaft.ts`): z=-1..0 air,
 * z=-2 stays solid as the cutaway back wall.
 */
export const MINESHAFT_Z_MIN = -1;
export const MINESHAFT_Z_MAX = 0;
/** Dig shaft occupies x=-1..0 — mineshafts stop short of these. */
const DIG_SHAFT_X_MIN = -1;
const DIG_SHAFT_X_MAX = 0;
/** Minimum solid blocks between mineshaft mouth and dig shaft. */
export const MINESHAFT_GAP_MIN = 1;
/** Extra random gap beyond the minimum (0..MAX inclusive). */
export const MINESHAFT_GAP_EXTRA_MAX = 2;

export type MineshaftSide = -1 | 1;

export interface MineshaftPlacement {
  /** Stable id `band:side`. */
  id: string;
  band: number;
  side: MineshaftSide;
  /** Bottom air-cell Y (negative block units). */
  floorY: number;
  /** Positive meters at the floor cell. */
  depthM: number;
  xMin: number;
  xMax: number;
}

function hash01(a: number, b: number, seed: number): number {
  let n =
    Math.imul(a | 0, 374761393) +
    Math.imul(b | 0, 668265263) +
    (seed | 0);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Floor Y for band `band` (≥0). */
export function mineshaftFloorY(band: number): number {
  if (band < 0) return 0;
  const j = (hash01(band, 17, 0x51af7) * 2 - 1) * MINESHAFT_JITTER_M;
  const depth = Math.max(
    28,
    Math.floor(MINESHAFT_START_M + band * MINESHAFT_BAND_M + j),
  );
  return -depth;
}

export function mineshaftSides(band: number): readonly MineshaftSide[] {
  if (band < 0) return [];
  const r = hash01(band, 3, 0xc0bb);
  // Deeper bands slightly more often open on both sides.
  const bothChance = Math.min(0.42, 0.12 + band * 0.02);
  if (r < bothChance) return [-1, 1];
  return r < bothChance + (1 - bothChance) * 0.5 ? [-1] : [1];
}

/** Solid columns between dig-shaft edge and mineshaft mouth (≥ gap min). */
export function mineshaftMouthGap(band: number, side: MineshaftSide): number {
  const extra = Math.floor(
    hash01(band, side, 0x9a90) * (MINESHAFT_GAP_EXTRA_MAX + 1),
  );
  return MINESHAFT_GAP_MIN + extra;
}

function xRange(
  band: number,
  side: MineshaftSide,
): { xMin: number; xMax: number } {
  const gap = mineshaftMouthGap(band, side);
  if (side < 0) {
    // Dig at x=-1; leave `gap` solid columns (x=-2, …) then air.
    return {
      xMin: -MINESHAFT_WALL_HALF,
      xMax: DIG_SHAFT_X_MIN - 1 - gap,
    };
  }
  // Dig at x=0; leave `gap` solid columns (x=1, …) then air.
  return {
    xMin: DIG_SHAFT_X_MAX + 1 + gap,
    xMax: MINESHAFT_WALL_HALF,
  };
}

export function mineshaftPlacement(
  band: number,
  side: MineshaftSide,
): MineshaftPlacement {
  const floorY = mineshaftFloorY(band);
  const { xMin, xMax } = xRange(band, side);
  return {
    id: `${band}:${side}`,
    band,
    side,
    floorY,
    depthM: -floorY,
    xMin,
    xMax,
  };
}

/** All placements whose floor falls in depth meters `[depthMin, depthMax]`. */
export function mineshaftsInDepthRange(
  depthMin: number,
  depthMax: number,
): MineshaftPlacement[] {
  const lo = Math.min(depthMin, depthMax);
  const hi = Math.max(depthMin, depthMax);
  if (!(hi >= MINESHAFT_START_M - MINESHAFT_JITTER_M)) return [];

  const bandLo = Math.max(
    0,
    Math.floor((lo - MINESHAFT_START_M - MINESHAFT_JITTER_M) / MINESHAFT_BAND_M) -
      1,
  );
  const bandHi =
    Math.floor((hi - MINESHAFT_START_M + MINESHAFT_JITTER_M) / MINESHAFT_BAND_M) +
    1;
  const out: MineshaftPlacement[] = [];
  for (let b = bandLo; b <= bandHi; b++) {
    const fy = mineshaftFloorY(b);
    const depth = -fy;
    if (depth < lo || depth > hi) continue;
    for (const side of mineshaftSides(b)) {
      out.push(mineshaftPlacement(b, side));
    }
  }
  return out;
}

/**
 * Whether this cutaway cell is carved as abandoned mineshaft air.
 * Dig-shaft cells are never mineshaft air (vertical dig owns them).
 */
export function isMineshaftAir(x: number, y: number, z: number): boolean {
  if (y > -3) return false;
  if (z < MINESHAFT_Z_MIN || z > MINESHAFT_Z_MAX) return false;
  if (isDigShaftCell(x, z)) return false;

  const depth = -y;
  const approx = Math.round((depth - MINESHAFT_START_M) / MINESHAFT_BAND_M);
  for (let b = approx - 1; b <= approx + 1; b++) {
    if (b < 0) continue;
    const fy = mineshaftFloorY(b);
    if (y < fy || y >= fy + MINESHAFT_HEIGHT) continue;
    for (const side of mineshaftSides(b)) {
      const { xMin, xMax } = xRange(b, side);
      if (x >= xMin && x <= xMax) return true;
    }
  }
  return false;
}

/** Cobweb chance on a ceiling cell (slightly denser deeper). */
export function mineshaftCobwebChance(depthM: number): number {
  return Math.min(0.62, 0.34 + depthM / 8_000);
}

/**
 * Cobwebs bias toward the dig-shaft mouth so they read on-camera.
 * `mouthX` = innermost air column (xMax on left, xMin on right).
 */
export function mineshaftHasCobweb(
  x: number,
  floorY: number,
  side: MineshaftSide,
  mouthX?: number,
): boolean {
  const depthM = -floorY;
  let chance = mineshaftCobwebChance(depthM);
  if (mouthX !== undefined) {
    const dist = Math.abs(x - mouthX);
    // Mouth cell ~1.6× base; fades over ~6 blocks inward.
    chance *= Math.max(0.55, 1.6 - dist * 0.12);
    chance = Math.min(0.85, chance);
  }
  return hash01(x, floorY, 0xc0b0 ^ (side + 2)) < chance;
}

/** Fraction of band/side shafts that get a minecart on the rails. */
export const MINESHAFT_MINECART_CHANCE = 0.25;
/** Fraction that get a spare crate/barrel on the rails. */
export const MINESHAFT_CRATE_CHANCE = 0.25;

/** ~25% of shafts get a cart (seeded per band/side). */
export function mineshaftHasMinecart(
  band: number,
  side: MineshaftSide,
): boolean {
  return hash01(band, side, 0xca27) < MINESHAFT_MINECART_CHANCE;
}

/** ~25% of shafts get a barrel or crate (seeded; may coexist with a cart). */
export function mineshaftHasCrate(band: number, side: MineshaftSide): boolean {
  return hash01(band, side, 0xc2a7) < MINESHAFT_CRATE_CHANCE;
}

/** How far into the tunnel from the dig-shaft mouth a cart may sit (blocks). */
export const MINESHAFT_MINECART_MAX_INSET = 3;

/**
 * Cell X near the dig-shaft mouth (inset 0…max).
 * Deterministic per band/side/seed; clamped to the tunnel.
 */
export function mineshaftMouthInsetX(
  band: number,
  side: MineshaftSide,
  xMin: number,
  xMax: number,
  seed: number,
  maxInset = MINESHAFT_MINECART_MAX_INSET,
): number {
  if (xMax < xMin) return xMin;
  const mouthX = side < 0 ? xMax : xMin;
  const tunnelLen = xMax - xMin + 1;
  const insetMax = Math.min(maxInset, tunnelLen - 1);
  const inset = Math.floor(hash01(band, side, seed) * (insetMax + 1));
  const x = mouthX - side * inset;
  return Math.min(xMax, Math.max(xMin, x));
}

/**
 * Cell X for a cart on this shaft's rails — at the mouth toward the player,
 * or at most `MINESHAFT_MINECART_MAX_INSET` blocks deeper into the tunnel.
 */
export function mineshaftMinecartX(
  band: number,
  side: MineshaftSide,
  xMin: number,
  xMax: number,
): number {
  return mineshaftMouthInsetX(band, side, xMin, xMax, 0xca28);
}

/** Crate/barrel X; prefers a different cell than the cart when both exist. */
export function mineshaftCrateX(
  band: number,
  side: MineshaftSide,
  xMin: number,
  xMax: number,
): number {
  let x = mineshaftMouthInsetX(band, side, xMin, xMax, 0xc2a8);
  if (
    mineshaftHasMinecart(band, side) &&
    x === mineshaftMinecartX(band, side, xMin, xMax)
  ) {
    const alt = mineshaftMouthInsetX(band, side, xMin, xMax, 0xc2a9);
    if (alt !== x) return alt;
    // Nudge one block deeper if the tunnel allows.
    const mouthX = side < 0 ? xMax : xMin;
    const nudged = Math.min(xMax, Math.max(xMin, x - side));
    if (nudged !== mouthX || xMax !== xMin) return nudged;
  }
  return x;
}

/** Barrel vs square crate. */
export function mineshaftCrateIsBarrel(
  band: number,
  side: MineshaftSide,
): boolean {
  return hash01(band, side, 0xc2aa) < 0.55;
}

/** Ceiling torch every few blocks (biased toward the mouth). */
export function mineshaftHasTorch(
  x: number,
  floorY: number,
  side: MineshaftSide,
  mouthX: number,
): boolean {
  const dist = Math.abs(x - mouthX);
  if (dist > 8) return false;
  // Roughly every 3rd column near the mouth (normalize for negative coords).
  const step = x + floorY + side;
  if (((step % 3) + 3) % 3 !== 0) return false;
  return hash01(x, floorY, 0x70c4 ^ (side + 3)) < 0.85;
}

/** Early shafts use wood ties; deeper switch toward iron. */
export type MineshaftDecorStyle = "wood" | "iron";

export function mineshaftDecorStyle(depthM: number): MineshaftDecorStyle {
  return depthM >= 4_000 ? "iron" : "wood";
}

/** Dirt granted once when tapping a minecart (rare side-shaft loot). */
export function mineshaftCartDirtReward(depthM: number): number {
  const d = Math.max(0, depthM);
  // Floor 1k; ~0.5 dirt/m so deep carts stay worth the detour.
  return Math.min(50_000, Math.floor(1000 + d * 0.5));
}
