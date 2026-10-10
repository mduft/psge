/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Rare collectible shaft coins (20 unique). Much sparser than dirt boosters.
 */
import { createSeededRng } from "@psge/engine";
import { DIG_SHAFT_XS, DIG_SHAFT_ZS } from "./digShaft.js";
import { BOOSTER_AUTO_GRACE_M } from "./boosters.js";

export const SPECIAL_COIN_COUNT = 20;

/** Mean spacing band — far sparser than dirt boosters (25–50 m). */
export const SPECIAL_SPACING_MIN = 220;
export const SPECIAL_SPACING_MAX = 480;

export const SPECIAL_FIRST_DEPTH_MIN = 55;
export const SPECIAL_FIRST_DEPTH_MAX = 110;

/** Tap premium at the surface — grows with the coin's depth. */
export const SPECIAL_TAP_PREMIUM_BASE = 2000;

/**
 * Dirt granted when tapping a special coin before auto-claim.
 * Starts at {@link SPECIAL_TAP_PREMIUM_BASE} and soft-ramps with depth.
 */
export function specialTapPremiumAtDepth(depth: number): number {
  const d = Math.max(0, depth);
  // Soft saturate: ~2K shallow, ~4–5K mid, ~8K+ deep crust / ancient.
  const t = Math.asinh(d / 2500) / Math.asinh(4);
  const mult = 1 + 3 * t + 2 * t * t;
  const raw = SPECIAL_TAP_PREMIUM_BASE * mult;
  return Math.max(SPECIAL_TAP_PREMIUM_BASE, Math.round(raw / 50) * 50);
}

export interface SpecialCoinDef {
  id: string;
  name: string;
  blurb: string;
  /** Letter / mark on the coin face. */
  mark: string;
  /** Face tint (sRGB hex). */
  tint: number;
}

export interface SpecialCoinPlacement {
  id: string;
  depth: number;
  x: number;
  z: number;
}

export interface SpecialCoinProgress {
  /** Unlock order. */
  unlocked: string[];
}

export interface SpecialCoinClaim {
  id: string;
  /** Tap premium dirt (0 on auto). */
  dirt: number;
  via: "tap" | "auto";
}

export const SPECIAL_COIN_DEFS: readonly SpecialCoinDef[] = [
  {
    id: "copper_bit",
    name: "Copper bit",
    blurb: "A crude early minting — still warm to the touch.",
    mark: "C",
    tint: 0xb87333,
  },
  {
    id: "tin_token",
    name: "Tin token",
    blurb: "Soft metal stamped with a crooked sun.",
    mark: "T",
    tint: 0xa8b0b8,
  },
  {
    id: "iron_obol",
    name: "Iron obol",
    blurb: "Heavy for its size; ferry fare for the dark.",
    mark: "I",
    tint: 0x6a7078,
  },
  {
    id: "bronze_seal",
    name: "Bronze seal",
    blurb: "A merchant's mark from a vanished road.",
    mark: "B",
    tint: 0xcd7f32,
  },
  {
    id: "silver_drop",
    name: "Silver drop",
    blurb: "Cool and bright, like meltwater.",
    mark: "S",
    tint: 0xc0c8d0,
  },
  {
    id: "electrum_chip",
    name: "Electrum chip",
    blurb: "Gold and silver mixed by accident or design.",
    mark: "E",
    tint: 0xd4c878,
  },
  {
    id: "gold_whisper",
    name: "Gold whisper",
    blurb: "Thin as foil, loud as greed.",
    mark: "G",
    tint: 0xe8c44a,
  },
  {
    id: "jade_disk",
    name: "Jade disk",
    blurb: "Carved, not minted — someone cared.",
    mark: "J",
    tint: 0x3a8a5a,
  },
  {
    id: "obsidian_flake",
    name: "Obsidian flake",
    blurb: "Glass-dark edge that never dulled.",
    mark: "O",
    tint: 0x2a2430,
  },
  {
    id: "amber_tear",
    name: "Amber tear",
    blurb: "A trapped spark behind cloudy gold.",
    mark: "A",
    tint: 0xd4882a,
  },
  {
    id: "onyx_ringlet",
    name: "Onyx ringlet",
    blurb: "A black circle for a black depth.",
    mark: "X",
    tint: 0x1a1a22,
  },
  {
    id: "coral_piece",
    name: "Coral piece",
    blurb: "Sea bone this far from any shore.",
    mark: "R",
    tint: 0xd06070,
  },
  {
    id: "pearl_slug",
    name: "Pearl slug",
    blurb: "Iridescent, almost soft under the thumb.",
    mark: "P",
    tint: 0xe8e0d8,
  },
  {
    id: "quartz_shard",
    name: "Quartz shard",
    blurb: "Faceted by pressure, not a jeweler.",
    mark: "Q",
    tint: 0xd0d8e8,
  },
  {
    id: "ruby_spark",
    name: "Ruby spark",
    blurb: "A red wink in the lamp-light.",
    mark: "U",
    tint: 0xc02040,
  },
  {
    id: "sapphire_pip",
    name: "Sapphire pip",
    blurb: "Cold blue — deeper than the sky ever was.",
    mark: "Y",
    tint: 0x2858c0,
  },
  {
    id: "emerald_pip",
    name: "Emerald pip",
    blurb: "Green like moss that shouldn't grow here.",
    mark: "M",
    tint: 0x2a8a48,
  },
  {
    id: "meteor_slug",
    name: "Meteor slug",
    blurb: "Iron from above, waiting below.",
    mark: "★",
    tint: 0x5a4a6a,
  },
  {
    id: "void_token",
    name: "Void token",
    blurb: "Absorbs the lamp. Best not to stare.",
    mark: "V",
    tint: 0x101018,
  },
  {
    id: "crown_fragment",
    name: "Crown fragment",
    blurb: "A king's edge, broken and buried.",
    mark: "K",
    tint: 0xf0d060,
  },
] as const;

const STREAM = 0xc01a5eed;

function hashSeed(worldSeed: number, salt: number): number {
  return (Math.imul(worldSeed ^ STREAM, 0x9e3779b1) ^ salt) >>> 0;
}

export function emptySpecialCoinProgress(): SpecialCoinProgress {
  return { unlocked: [] };
}

export function normalizeSpecialCoinProgress(
  raw: unknown,
): SpecialCoinProgress {
  if (!raw || typeof raw !== "object") return emptySpecialCoinProgress();
  const o = raw as Record<string, unknown>;
  const unlocked: string[] = [];
  const known = new Set(SPECIAL_COIN_DEFS.map((d) => d.id));
  if (Array.isArray(o.unlocked)) {
    const seen = new Set<string>();
    for (const id of o.unlocked) {
      if (typeof id !== "string" || !known.has(id) || seen.has(id)) continue;
      seen.add(id);
      unlocked.push(id);
    }
  }
  return { unlocked };
}

export function getSpecialCoinDef(id: string): SpecialCoinDef | undefined {
  return SPECIAL_COIN_DEFS.find((d) => d.id === id);
}

/** Debug / tests: unlock the next unowned special coin in catalog order. */
export function unlockNextSpecialCoin(
  progress: SpecialCoinProgress,
): string | null {
  const owned = new Set(progress.unlocked);
  for (const def of SPECIAL_COIN_DEFS) {
    if (owned.has(def.id)) continue;
    progress.unlocked.push(def.id);
    return def.id;
  }
  return null;
}

/**
 * Exactly {@link SPECIAL_COIN_COUNT} placements, deterministic from worldSeed.
 */
export function generateSpecialCoins(
  worldSeed: number,
): SpecialCoinPlacement[] {
  const rng = createSeededRng(hashSeed(worldSeed, 3));
  const out: SpecialCoinPlacement[] = [];
  let depth =
    SPECIAL_FIRST_DEPTH_MIN +
    rng.next() * (SPECIAL_FIRST_DEPTH_MAX - SPECIAL_FIRST_DEPTH_MIN);
  for (let i = 0; i < SPECIAL_COIN_COUNT; i++) {
    const def = SPECIAL_COIN_DEFS[i]!;
    const xi = rng.nextInt(0, DIG_SHAFT_XS.length);
    const zi = rng.nextInt(0, DIG_SHAFT_ZS.length);
    out.push({
      id: def.id,
      depth: Math.round(depth * 1000) / 1000,
      x: DIG_SHAFT_XS[xi]! + 0.3 + rng.next() * 0.4,
      z: DIG_SHAFT_ZS[zi]! + 0.3 + rng.next() * 0.4,
    });
    depth +=
      SPECIAL_SPACING_MIN +
      rng.next() * (SPECIAL_SPACING_MAX - SPECIAL_SPACING_MIN);
  }
  return out;
}

export function isSpecialVisible(
  coin: SpecialCoinPlacement,
  excavatedDepth: number,
): boolean {
  return excavatedDepth >= coin.depth;
}

export function isSpecialAutoDue(
  coin: SpecialCoinPlacement,
  excavatedDepth: number,
): boolean {
  return excavatedDepth >= coin.depth + BOOSTER_AUTO_GRACE_M;
}

function unlock(progress: SpecialCoinProgress, id: string): boolean {
  if (progress.unlocked.includes(id)) return false;
  progress.unlocked.push(id);
  return true;
}

/**
 * Auto-claim after dig-past grace (collection only — no dirt premium).
 * Same grace window as dirt boosters so they hang in the shaft the same way.
 */
export function claimAutoSpecialCoins(
  progress: SpecialCoinProgress,
  worldSeed: number,
  excavatedDepth: number,
): SpecialCoinClaim[] {
  const owned = new Set(progress.unlocked);
  const out: SpecialCoinClaim[] = [];
  for (const c of generateSpecialCoins(worldSeed)) {
    if (owned.has(c.id)) continue;
    if (!isSpecialAutoDue(c, excavatedDepth)) continue;
    if (unlock(progress, c.id)) {
      out.push({ id: c.id, dirt: 0, via: "auto" });
    }
  }
  return out;
}

/**
 * Tap-claim while visible and within grace — unlocks + depth-scaled dirt premium.
 */
export function claimTapSpecialCoin(
  progress: SpecialCoinProgress,
  worldSeed: number,
  excavatedDepth: number,
  id: string,
): SpecialCoinClaim | null {
  if (progress.unlocked.includes(id)) return null;
  const c = generateSpecialCoins(worldSeed).find((x) => x.id === id);
  if (!c) return null;
  if (!isSpecialVisible(c, excavatedDepth)) return null;
  if (isSpecialAutoDue(c, excavatedDepth)) return null;
  if (!unlock(progress, id)) return null;
  return {
    id,
    dirt: specialTapPremiumAtDepth(c.depth),
    via: "tap",
  };
}

export function visibleSpecialCoins(
  progress: SpecialCoinProgress,
  worldSeed: number,
  excavatedDepth: number,
): SpecialCoinPlacement[] {
  const owned = new Set(progress.unlocked);
  return generateSpecialCoins(worldSeed).filter(
    (c) =>
      !owned.has(c.id) &&
      isSpecialVisible(c, excavatedDepth) &&
      !isSpecialAutoDue(c, excavatedDepth),
  );
}
