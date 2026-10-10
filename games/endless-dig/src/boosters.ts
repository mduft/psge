/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Seeded dirt-coin boosters in the shaft. Auto-collect at 1× after a short
 * dig-past grace; tap the mesh for 2× before that.
 */
import { createSeededRng } from "@psge/engine";
import { DIG_SHAFT_XS, DIG_SHAFT_ZS } from "./digShaft.js";

export const BOOSTER_VALUES = [50, 100, 200, 500] as const;
export type BoosterValue = (typeof BOOSTER_VALUES)[number];

/** Mean spacing band (meters between coins). */
export const BOOSTER_SPACING_MIN = 25;
export const BOOSTER_SPACING_MAX = 50;

/** Dig this far past a coin without tapping → auto-claim at 1×. */
export const BOOSTER_AUTO_GRACE_M = 4;

/** First possible coin (avoid surface clutter). */
export const BOOSTER_FIRST_DEPTH_MIN = 12;
export const BOOSTER_FIRST_DEPTH_MAX = 28;

export interface DirtBooster {
  id: string;
  /** Absolute depth (m) where the coin sits. */
  depth: number;
  value: BoosterValue;
  /** Block-space XZ inside the dig shaft footprint. */
  x: number;
  z: number;
}

export interface BoosterProgress {
  /** Claimed booster ids (order = claim order). */
  claimed: string[];
}

export interface BoosterClaim {
  id: string;
  value: BoosterValue;
  dirt: number;
  via: "tap" | "auto";
}

const STREAM = 0x60b57c01;

function hashSeed(worldSeed: number, salt: number): number {
  return (Math.imul(worldSeed ^ STREAM, 0x9e3779b1) ^ salt) >>> 0;
}

export function emptyBoosterProgress(): BoosterProgress {
  return { claimed: [] };
}

export function normalizeBoosterProgress(raw: unknown): BoosterProgress {
  if (!raw || typeof raw !== "object") return emptyBoosterProgress();
  const o = raw as Record<string, unknown>;
  const claimed: string[] = [];
  if (Array.isArray(o.claimed)) {
    const seen = new Set<string>();
    for (const id of o.claimed) {
      if (typeof id !== "string" || id.length === 0 || seen.has(id)) continue;
      seen.add(id);
      claimed.push(id);
    }
  }
  return { claimed };
}

/**
 * Depth-weighted value: shallow favors 50/100; deep favors 200/500.
 * `t` soft-saturates so mid-game already shifts without waiting for abyss.
 */
export function valueWeightsAtDepth(depth: number): readonly [
  number,
  number,
  number,
  number,
] {
  const t = Math.min(1, Math.asinh(Math.max(0, depth) / 2500) / Math.asinh(4));
  const w50 = 0.48 * (1 - t) + 0.06 * t;
  const w100 = 0.3 * (1 - t) + 0.16 * t;
  const w200 = 0.15 * (1 - t) + 0.34 * t;
  const w500 = 0.07 * (1 - t) + 0.44 * t;
  return [w50, w100, w200, w500];
}

export function rollBoosterValue(
  next: () => number,
  depth: number,
): BoosterValue {
  const w = valueWeightsAtDepth(depth);
  const sum = w[0] + w[1] + w[2] + w[3];
  let r = next() * sum;
  for (let i = 0; i < BOOSTER_VALUES.length; i++) {
    r -= w[i]!;
    if (r <= 0) return BOOSTER_VALUES[i]!;
  }
  return BOOSTER_VALUES[BOOSTER_VALUES.length - 1]!;
}

/**
 * Deterministic coin list from surface down through `maxDepth` (inclusive pad).
 * Spacing per gap is uniform in [25, 50] m.
 */
export function generateBoosters(
  worldSeed: number,
  maxDepth: number,
): DirtBooster[] {
  const cap = Math.max(0, maxDepth);
  const rng = createSeededRng(hashSeed(worldSeed, 1));
  const out: DirtBooster[] = [];
  let depth =
    BOOSTER_FIRST_DEPTH_MIN +
    rng.next() * (BOOSTER_FIRST_DEPTH_MAX - BOOSTER_FIRST_DEPTH_MIN);
  let index = 0;
  while (depth <= cap) {
    const xi = rng.nextInt(0, DIG_SHAFT_XS.length);
    const zi = rng.nextInt(0, DIG_SHAFT_ZS.length);
    const x = DIG_SHAFT_XS[xi]! + 0.35 + rng.next() * 0.3;
    const z = DIG_SHAFT_ZS[zi]! + 0.35 + rng.next() * 0.3;
    const value = rollBoosterValue(() => rng.next(), depth);
    out.push({
      id: `b${index}`,
      depth: Math.round(depth * 1000) / 1000,
      value,
      x,
      z,
    });
    depth +=
      BOOSTER_SPACING_MIN +
      rng.next() * (BOOSTER_SPACING_MAX - BOOSTER_SPACING_MIN);
    index += 1;
  }
  return out;
}

export function isBoosterVisible(
  booster: DirtBooster,
  excavatedDepth: number,
): boolean {
  return excavatedDepth >= booster.depth;
}

export function isBoosterAutoDue(
  booster: DirtBooster,
  excavatedDepth: number,
): boolean {
  return excavatedDepth >= booster.depth + BOOSTER_AUTO_GRACE_M;
}

function markClaimed(progress: BoosterProgress, id: string): boolean {
  if (progress.claimed.includes(id)) return false;
  progress.claimed.push(id);
  return true;
}

/**
 * Auto-claim every unclaimed coin whose grace window has closed.
 */
export function claimAutoBoosters(
  progress: BoosterProgress,
  worldSeed: number,
  excavatedDepth: number,
): BoosterClaim[] {
  const claimed = new Set(progress.claimed);
  const due = generateBoosters(
    worldSeed,
    excavatedDepth,
  ).filter((b) => !claimed.has(b.id) && isBoosterAutoDue(b, excavatedDepth));
  const out: BoosterClaim[] = [];
  for (const b of due) {
    if (!markClaimed(progress, b.id)) continue;
    out.push({ id: b.id, value: b.value, dirt: b.value, via: "auto" });
  }
  return out;
}

/**
 * Tap-claim at 2× if the coin is revealed, still within the grace window,
 * and not yet claimed.
 */
export function claimTapBooster(
  progress: BoosterProgress,
  worldSeed: number,
  excavatedDepth: number,
  id: string,
): BoosterClaim | null {
  if (progress.claimed.includes(id)) return null;
  const list = generateBoosters(worldSeed, excavatedDepth + BOOSTER_AUTO_GRACE_M);
  const b = list.find((c) => c.id === id);
  if (!b) return null;
  if (!isBoosterVisible(b, excavatedDepth)) return null;
  if (isBoosterAutoDue(b, excavatedDepth)) return null;
  if (!markClaimed(progress, b.id)) return null;
  return { id: b.id, value: b.value, dirt: b.value * 2, via: "tap" };
}

/** Unclaimed coins currently visible (for mesh sync). */
export function visibleBoosters(
  progress: BoosterProgress,
  worldSeed: number,
  excavatedDepth: number,
): DirtBooster[] {
  const claimed = new Set(progress.claimed);
  return generateBoosters(worldSeed, excavatedDepth).filter(
    (b) =>
      !claimed.has(b.id) &&
      isBoosterVisible(b, excavatedDepth) &&
      !isBoosterAutoDue(b, excavatedDepth),
  );
}
