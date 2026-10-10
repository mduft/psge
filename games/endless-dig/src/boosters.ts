/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Seeded dirt-coin boosters in the shaft. Auto-collect at 1× after a short
 * dig-past grace; tap for depth-scaled × combo dirt before that.
 */
import { createSeededRng } from "@psge/engine";
import { DIG_SHAFT_XS, DIG_SHAFT_ZS } from "./digShaft.js";

export const BOOSTER_VALUES = [50, 100, 200, 500] as const;
export type BoosterValue = (typeof BOOSTER_VALUES)[number];

/** Mean spacing band (meters between coins). */
export const BOOSTER_SPACING_MIN = 25;
export const BOOSTER_SPACING_MAX = 50;

/** Dig this far past a coin without tapping → auto-claim at 1×.
 * Tuned so the mesh stays tappable until it is about to leave the framed shaft. */
export const BOOSTER_AUTO_GRACE_M = 6;

/** First possible coin (avoid surface clutter). */
export const BOOSTER_FIRST_DEPTH_MIN = 12;
export const BOOSTER_FIRST_DEPTH_MAX = 28;

/** Manual tap depth mult: `BASE + EXTRA * t(depth)` — surface ≈ BASE. */
export const BOOSTER_TAP_DEPTH_BASE = 2;
export const BOOSTER_TAP_DEPTH_EXTRA = 3;

/** Manual tap combo: `min(CAP, 1 + STEP * (streak - 1))`. */
export const BOOSTER_COMBO_STEP = 0.25;
export const BOOSTER_COMBO_CAP = 3;

/** Combo expires if no dirt-coin tap within this wall-clock window. */
export const BOOSTER_COMBO_TIMEOUT_MS = 30_000;

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
  /** Total dirt granted by claimed coins (includes tap depth×combo mult). */
  dirtEarned: number;
  /** Live manual-tap streak (0 = none). Persisted; expires via {@link comboAtMs}. */
  combo: number;
  /** Wall-clock ms of last dirt-coin tap (0 if no streak). */
  comboAtMs: number;
}

export interface BoosterClaim {
  id: string;
  value: BoosterValue;
  dirt: number;
  via: "tap" | "auto";
  /** Tap streak after this claim (1+); omitted / 0 on auto. */
  combo?: number;
  /** Effective tap mult (`depthMult * comboMult`); omitted on auto. */
  mult?: number;
}

/** Soft depth factor shared with special-coin premium curve. */
export function boosterDepthT(depth: number): number {
  return Math.min(1, Math.asinh(Math.max(0, depth) / 2500) / Math.asinh(4));
}

/** Manual tap depth multiplier (tunable via BOOSTER_TAP_DEPTH_*). */
export function boosterTapDepthMult(depth: number): number {
  return BOOSTER_TAP_DEPTH_BASE + BOOSTER_TAP_DEPTH_EXTRA * boosterDepthT(depth);
}

/** Manual tap combo multiplier for streak ≥ 1 (tunable via BOOSTER_COMBO_*). */
export function boosterComboMult(streak: number): number {
  const n = Math.max(1, Math.floor(streak));
  return Math.min(BOOSTER_COMBO_CAP, 1 + BOOSTER_COMBO_STEP * (n - 1));
}

/** Dirt granted for a manual tap of a dirt coin. */
export function boosterTapDirt(
  value: BoosterValue,
  depth: number,
  streak: number,
): { dirt: number; mult: number; depthMult: number; comboMult: number } {
  const depthMult = boosterTapDepthMult(depth);
  const comboMult = boosterComboMult(streak);
  const mult = depthMult * comboMult;
  return {
    dirt: Math.max(0, Math.floor(value * mult)),
    mult,
    depthMult,
    comboMult,
  };
}

const STREAM = 0x60b57c01;

function hashSeed(worldSeed: number, salt: number): number {
  return (Math.imul(worldSeed ^ STREAM, 0x9e3779b1) ^ salt) >>> 0;
}

export function emptyBoosterProgress(): BoosterProgress {
  return { claimed: [], dirtEarned: 0, combo: 0, comboAtMs: 0 };
}

function parseNonNegInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string" && value.length > 0) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

/** Clear combo when the 30s window has elapsed (wall-clock). */
export function expireBoosterCombo(
  progress: BoosterProgress,
  nowMs: number = Date.now(),
): boolean {
  if (progress.combo <= 0) {
    if (progress.comboAtMs !== 0) {
      progress.comboAtMs = 0;
      return true;
    }
    return false;
  }
  if (
    progress.comboAtMs <= 0 ||
    nowMs - progress.comboAtMs > BOOSTER_COMBO_TIMEOUT_MS
  ) {
    progress.combo = 0;
    progress.comboAtMs = 0;
    return true;
  }
  return false;
}

export function clearBoosterCombo(progress: BoosterProgress): void {
  progress.combo = 0;
  progress.comboAtMs = 0;
}

export function noteBoosterComboTap(
  progress: BoosterProgress,
  streak: number,
  nowMs: number = Date.now(),
): void {
  progress.combo = Math.max(0, Math.floor(streak));
  progress.comboAtMs = Math.max(0, Math.floor(nowMs));
}

export function normalizeBoosterProgress(
  raw: unknown,
  nowMs: number = Date.now(),
): BoosterProgress {
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
  const out: BoosterProgress = {
    claimed,
    dirtEarned: parseNonNegInt(o.dirtEarned),
    combo: parseNonNegInt(o.combo),
    comboAtMs: parseNonNegInt(o.comboAtMs),
  };
  expireBoosterCombo(out, nowMs);
  return out;
}

/** How many coins have been collected. */
export function boosterCoinsCollected(progress: BoosterProgress): number {
  return progress.claimed.length;
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

function markClaimed(
  progress: BoosterProgress,
  id: string,
  dirt: number,
): boolean {
  if (progress.claimed.includes(id)) return false;
  progress.claimed.push(id);
  progress.dirtEarned += Math.max(0, Math.floor(dirt));
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
    const dirt = b.value;
    if (!markClaimed(progress, b.id, dirt)) continue;
    out.push({ id: b.id, value: b.value, dirt, via: "auto" });
  }
  return out;
}

/**
 * Tap-claim with depth × combo mult if the coin is revealed, still within
 * the grace window, and not yet claimed. `streak` is 1 for the first tap in
 * a combo chain.
 */
export function claimTapBooster(
  progress: BoosterProgress,
  worldSeed: number,
  excavatedDepth: number,
  id: string,
  streak = 1,
): BoosterClaim | null {
  if (progress.claimed.includes(id)) return null;
  const list = generateBoosters(worldSeed, excavatedDepth + BOOSTER_AUTO_GRACE_M);
  const b = list.find((c) => c.id === id);
  if (!b) return null;
  if (!isBoosterVisible(b, excavatedDepth)) return null;
  if (isBoosterAutoDue(b, excavatedDepth)) return null;
  const combo = Math.max(1, Math.floor(streak));
  const { dirt, mult } = boosterTapDirt(b.value, b.depth, combo);
  if (!markClaimed(progress, b.id, dirt)) return null;
  return { id: b.id, value: b.value, dirt, via: "tap", combo, mult };
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
