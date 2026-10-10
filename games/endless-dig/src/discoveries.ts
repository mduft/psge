/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Milestone 7 — deterministic discoveries (milestones + seeded dig rolls).
 */
import { createSeededRng } from "@psge/engine";
import type { GeoLayerId } from "./geoLayers.js";

export type DiscoveryKind = "milestone" | "roll";

export type DiscoveryIcon =
  | "bone"
  | "coin"
  | "shard"
  | "crystal"
  | "gear"
  | "stone"
  | "tablet"
  | "orb";

export interface DiscoveryDef {
  id: string;
  name: string;
  blurb: string;
  minDepth: number;
  kind: DiscoveryKind;
  /** Optional geo-band hint for catalog grouping. */
  layerId?: GeoLayerId;
  /** Relative weight among eligible roll finds (roll kind only). */
  rollWeight?: number;
  icon: DiscoveryIcon;
  /** Shaft prop tint (sRGB hex). */
  propTint: number;
}

export interface DiscoveryProgress {
  /** Unlock order. */
  unlocked: string[];
  /** Fixed at first run; drives dig rolls. */
  worldSeed: number;
  /** Fractional meters banked toward the next whole-meter roll check. */
  digRollMeter: number;
}

/** Catalog — basic placeholders; art can replace icons/props later. */
export const DISCOVERY_DEFS: readonly DiscoveryDef[] = [
  {
    id: "bone_shard",
    name: "Ancient bone",
    blurb: "A weathered fragment from something that once walked.",
    minDepth: 25,
    kind: "milestone",
    layerId: "soil",
    icon: "bone",
    propTint: 0xe8dcc8,
  },
  {
    id: "old_coin",
    name: "Old coin",
    blurb: "Tarnished metal with a face nobody remembers.",
    minDepth: 40,
    kind: "roll",
    layerId: "soil",
    rollWeight: 3,
    icon: "coin",
    propTint: 0xc4a050,
  },
  {
    id: "river_pebble",
    name: "River pebble",
    blurb: "Smooth stone that should not be this deep.",
    minDepth: 120,
    kind: "roll",
    layerId: "soil",
    rollWeight: 2,
    icon: "stone",
    propTint: 0x6a7a88,
  },
  {
    id: "clay_shard",
    name: "Pottery shard",
    blurb: "Fired clay with a hint of a painted rim.",
    minDepth: 1_000,
    kind: "milestone",
    layerId: "clay",
    icon: "shard",
    propTint: 0xb07040,
  },
  {
    id: "amber_drop",
    name: "Amber drop",
    blurb: "Warm resin trapping a speck of something older.",
    minDepth: 1_200,
    kind: "roll",
    layerId: "clay",
    rollWeight: 2,
    icon: "orb",
    propTint: 0xd48a20,
  },
  {
    id: "bedrock_chisel",
    name: "Broken chisel",
    blurb: "Someone else dug here, long ago.",
    minDepth: 4_000,
    kind: "milestone",
    layerId: "bedrock",
    icon: "gear",
    propTint: 0x8a9098,
  },
  {
    id: "iron_nail",
    name: "Iron nail",
    blurb: "Bent and rusted, but still sharp enough to matter.",
    minDepth: 4_500,
    kind: "roll",
    layerId: "bedrock",
    rollWeight: 2,
    icon: "gear",
    propTint: 0x5a5048,
  },
  {
    id: "deep_crystal",
    name: "Deep crystal",
    blurb: "A clear prism that catches light that is not there.",
    minDepth: 12_000,
    kind: "milestone",
    layerId: "deep_crust",
    icon: "crystal",
    propTint: 0x70c8e8,
  },
  {
    id: "slate_tablet",
    name: "Slate tablet",
    blurb: "Scratches that almost look like writing.",
    minDepth: 14_000,
    kind: "roll",
    layerId: "deep_crust",
    rollWeight: 2,
    icon: "tablet",
    propTint: 0x3a4450,
  },
  {
    id: "jade_fleck",
    name: "Jade fleck",
    blurb: "A green chip from a larger, missing whole.",
    minDepth: 40_000,
    kind: "milestone",
    layerId: "ancient",
    icon: "crystal",
    propTint: 0x2affc8,
  },
  {
    id: "glyph_disk",
    name: "Glyph disk",
    blurb: "A flat stone ring etched with spirals.",
    minDepth: 45_000,
    kind: "roll",
    layerId: "ancient",
    rollWeight: 1,
    icon: "tablet",
    propTint: 0x4a6860,
  },
  {
    id: "abyss_ember",
    name: "Abyss ember",
    blurb: "It glows without heat. You should not have touched it.",
    minDepth: 120_000,
    kind: "milestone",
    layerId: "abyss",
    icon: "orb",
    propTint: 0xff6622,
  },
] as const;

const DEF_BY_ID = new Map(DISCOVERY_DEFS.map((d) => [d.id, d]));

export function getDiscoveryDef(id: string): DiscoveryDef | undefined {
  return DEF_BY_ID.get(id);
}

export function emptyDiscoveryProgress(worldSeed?: number): DiscoveryProgress {
  const seed =
    typeof worldSeed === "number" && Number.isFinite(worldSeed)
      ? worldSeed >>> 0
      : (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
  return { unlocked: [], worldSeed: seed || 1, digRollMeter: 0 };
}

export function normalizeDiscoveryProgress(
  raw: unknown,
  fallbackSeed?: number,
): DiscoveryProgress {
  const base = emptyDiscoveryProgress(fallbackSeed);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const unlocked: string[] = [];
  if (Array.isArray(o.unlocked)) {
    const seen = new Set<string>();
    for (const id of o.unlocked) {
      if (typeof id !== "string" || !DEF_BY_ID.has(id) || seen.has(id)) continue;
      seen.add(id);
      unlocked.push(id);
    }
  }
  let worldSeed = base.worldSeed;
  if (typeof o.worldSeed === "number" && Number.isFinite(o.worldSeed)) {
    worldSeed = o.worldSeed >>> 0 || 1;
  }
  let digRollMeter = 0;
  if (typeof o.digRollMeter === "number" && Number.isFinite(o.digRollMeter)) {
    digRollMeter = Math.min(1, Math.max(0, o.digRollMeter));
  }
  return { unlocked, worldSeed, digRollMeter };
}

function hashSeed(worldSeed: number, meterIndex: number): number {
  let n =
    Math.imul(worldSeed | 0, 374761393) +
    Math.imul(meterIndex | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

/** Chance to attempt a roll find when crossing one meter at this depth. */
export function rollChanceAtDepth(depth: number): number {
  const d = Math.max(0, depth);
  // ~2% near surface → ~8% by abyss; soft so spam stays rare.
  return Math.min(0.08, 0.02 + d / 2_000_000);
}

function unlock(progress: DiscoveryProgress, id: string): boolean {
  if (progress.unlocked.includes(id)) return false;
  if (!DEF_BY_ID.has(id)) return false;
  progress.unlocked.push(id);
  return true;
}

function pickWeightedRoll(
  eligible: DiscoveryDef[],
  rng: { next(): number },
): DiscoveryDef | null {
  if (eligible.length === 0) return null;
  let total = 0;
  for (const d of eligible) total += Math.max(0, d.rollWeight ?? 1);
  if (!(total > 0)) return eligible[0]!;
  let t = rng.next() * total;
  for (const d of eligible) {
    t -= Math.max(0, d.rollWeight ?? 1);
    if (t <= 0) return d;
  }
  return eligible[eligible.length - 1]!;
}

export interface ResolveDiscoveriesResult {
  newlyUnlocked: string[];
}

/**
 * Apply milestone + dig-roll unlocks for a depth span.
 * Mutates `progress` (unlocked + digRollMeter). At most one roll-find per call.
 */
export function resolveDiscoveries(
  progress: DiscoveryProgress,
  depthBefore: number,
  depthAfter: number,
): ResolveDiscoveriesResult {
  const newlyUnlocked: string[] = [];
  const before = Math.max(0, depthBefore);
  const after = Math.max(0, depthAfter);
  if (!(after > before)) return { newlyUnlocked };

  for (const def of DISCOVERY_DEFS) {
    if (def.kind !== "milestone") continue;
    if (def.minDepth <= before || def.minDepth > after) continue;
    if (unlock(progress, def.id)) newlyUnlocked.push(def.id);
  }

  // One roll check per whole meter of absolute depth crossed.
  const firstMeter = Math.floor(before) + 1;
  const lastMeter = Math.floor(after);
  let rolled = false;
  for (let meter = firstMeter; meter <= lastMeter; meter++) {
    if (rolled) break;
    const rng = createSeededRng(hashSeed(progress.worldSeed, meter));
    if (rng.next() >= rollChanceAtDepth(meter)) continue;
    const owned = new Set(progress.unlocked);
    const eligible = DISCOVERY_DEFS.filter(
      (d) =>
        d.kind === "roll" &&
        d.minDepth <= meter &&
        !owned.has(d.id),
    );
    const pick = pickWeightedRoll(eligible, rng);
    if (!pick) continue;
    if (unlock(progress, pick.id)) {
      newlyUnlocked.push(pick.id);
      rolled = true;
    }
  }
  progress.digRollMeter = after - Math.floor(after);

  return { newlyUnlocked };
}

/** Debug / tests: unlock the next locked catalog entry by catalog order. */
export function unlockNextDiscovery(
  progress: DiscoveryProgress,
): string | null {
  for (const def of DISCOVERY_DEFS) {
    if (unlock(progress, def.id)) return def.id;
  }
  return null;
}

/** Deterministic wall placement for a discovery prop (block coords). */
export function discoveryPropCell(
  id: string,
  worldSeed: number,
): { x: number; y: number; z: number } {
  const def = DEF_BY_ID.get(id);
  const minY = def ? -Math.ceil(def.minDepth) : -10;
  const rng = createSeededRng(hashSeed(worldSeed, id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)));
  // Prefer cutaway wall columns away from shaft (−1/0).
  const wallXs = [-8, -6, -4, -3, 2, 3, 5, 7, 10, 12];
  const x = wallXs[rng.nextInt(0, wallXs.length)]!;
  const z = rng.next() < 0.5 ? -2 : 0;
  const yJitter = rng.nextInt(0, 5);
  const y = Math.min(-3, minY + yJitter);
  return { x, y, z };
}
