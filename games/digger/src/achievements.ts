/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Milestone 9 — durable meta unlocks (celebration chrome, not dig power).
 */
import Decimal from "decimal.js";
import { DISCOVERY_DEFS } from "./discoveries.js";
import { geoLayerAt, type GeoLayerId } from "./geoLayers.js";
import {
  UPGRADE_IDS,
  type UpgradeId,
  type UpgradeLevels,
} from "./upgrades.js";

/** Minimal state shape for unlock checks (avoids import cycles with gameState). */
export interface AchievementEvalState {
  depth: Decimal;
  dirt: Decimal;
  upgrades: UpgradeLevels;
  discoveries: { unlocked: readonly string[] };
  achievements: AchievementProgress;
}

export interface AchievementDef {
  id: string;
  name: string;
  blurb: string;
  /** Shown while locked. */
  hint: string;
}

export interface AchievementProgress {
  unlocked: string[];
  /** Set when passive dig has advanced depth at least once. */
  afkDigSeen: boolean;
  /** Set when the player completes an offline claim. */
  overnightClaimed: boolean;
  /** Set when a side mineshaft has entered the loaded window. */
  mineshaftSeen: boolean;
  /** Unique minecart ids that have scrolled into view (all-time). */
  seenMinecarts: string[];
  /** Minecart ids already tapped for dirt loot. */
  claimedMinecarts: string[];
  /** Barrel ids already tapped for dirt loot. */
  claimedBarrels: string[];
  /** Crate ids already tapped for a free tap upgrade. */
  claimedCrates: string[];
}

const LAYER_ACHIEVEMENTS: readonly {
  id: string;
  layerId: GeoLayerId;
  name: string;
  blurb: string;
}[] = [
  {
    id: "layer-clay",
    layerId: "clay",
    name: "Packed clay",
    blurb: "You left the topsoil behind.",
  },
  {
    id: "layer-bedrock",
    layerId: "bedrock",
    name: "Into bedrock",
    blurb: "The stone starts fighting back.",
  },
  {
    id: "layer-deep_crust",
    layerId: "deep_crust",
    name: "Deep crust",
    blurb: "Kilometres down, still digging.",
  },
  {
    id: "layer-ancient",
    layerId: "ancient",
    name: "Ancient rock",
    blurb: "Older than maps remember.",
  },
  {
    id: "layer-abyss",
    layerId: "abyss",
    name: "The Abyss",
    blurb: "There is no floor — only further.",
  },
];

const LEVEL_ACHIEVEMENTS: readonly {
  id: string;
  upgradeId: UpgradeId;
  level: number;
  label: string;
  name: string;
  blurb: string;
}[] = [
  {
    id: "shovel-10",
    upgradeId: "shovel",
    level: 10,
    label: "Shovel",
    name: "Seasoned shovel",
    blurb: "Ten upgrades of honest digging.",
  },
  {
    id: "pickaxe-10",
    upgradeId: "pickaxe",
    level: 10,
    label: "Pickaxe",
    name: "Sharpened pickaxe",
    blurb: "Every swing bites deeper.",
  },
  {
    id: "jackhammer-10",
    upgradeId: "jackhammer",
    level: 10,
    label: "Jackhammer",
    name: "Tuned jackhammer",
    blurb: "The whole shaft rattles.",
  },
  {
    id: "cart-10",
    upgradeId: "cart",
    level: 10,
    label: "Hand cart",
    name: "Cart convoy",
    blurb: "A steady line of carts.",
  },
  {
    id: "drill-10",
    upgradeId: "drill",
    level: 10,
    label: "Drill",
    name: "Industrial drill",
    blurb: "Rock dust never settles.",
  },
  {
    id: "crew-10",
    upgradeId: "crew",
    level: 10,
    label: "Dig crew",
    name: "Veteran crew",
    blurb: "They know the shaft better than you.",
  },
];

/** Catalog order = sheet order. */
export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  {
    id: "first-dig",
    name: "First dig",
    blurb: "The shaft begins.",
    hint: "Dig once.",
  },
  {
    id: "depth-10",
    name: "Ten metres",
    blurb: "A respectable hole.",
    hint: "Reach 10 m.",
  },
  {
    id: "depth-100",
    name: "Hundred metres",
    blurb: "Past the garden, into the earth.",
    hint: "Reach 100 m.",
  },
  {
    id: "depth-1k",
    name: "Kilometre club",
    blurb: "Four figures of depth.",
    hint: "Reach 1 000 m.",
  },
  {
    id: "depth-10k",
    name: "Ten kilometres",
    blurb: "The surface is a rumour.",
    hint: "Reach 10 000 m.",
  },
  {
    id: "depth-100k",
    name: "Hundred kilometres",
    blurb: "Deeper than any mine ever dared.",
    hint: "Reach 100 000 m.",
  },
  {
    id: "depth-1m",
    name: "Megametre",
    blurb: "A million metres of shaft.",
    hint: "Reach 1 000 000 m.",
  },
  {
    id: "depth-10m",
    name: "Through and through",
    blurb: "Longer than the planet is wide.",
    hint: "Reach 10 000 000 m.",
  },
  ...LAYER_ACHIEVEMENTS.map((l) => ({
    id: l.id,
    name: l.name,
    blurb: l.blurb,
    hint: `Reach the ${l.name} layer.`,
  })),
  {
    id: "first-purchase",
    name: "First purchase",
    blurb: "Dirt well spent.",
    hint: "Buy any shop upgrade.",
  },
  {
    id: "own-shovel",
    name: "Shovel owner",
    blurb: "Better than bare hands.",
    hint: "Own a shovel.",
  },
  {
    id: "own-pickaxe",
    name: "Pickaxe owner",
    blurb: "Pointy progress.",
    hint: "Own a pickaxe.",
  },
  {
    id: "own-jackhammer",
    name: "Jackhammer owner",
    blurb: "Loud and proud.",
    hint: "Own a jackhammer.",
  },
  {
    id: "full-kit",
    name: "Full kit",
    blurb: "Shovel, pickaxe, and jackhammer.",
    hint: "Own all three tap tools.",
  },
  {
    id: "cart-crew",
    name: "Idle help",
    blurb: "Something digs while you watch.",
    hint: "Own any auto dig upgrade.",
  },
  {
    id: "own-drill",
    name: "Drill owner",
    blurb: "Spinning steel does the work.",
    hint: "Own a drill.",
  },
  {
    id: "own-crew",
    name: "Crew boss",
    blurb: "You hired people to dig for you.",
    hint: "Own a dig crew.",
  },
  {
    id: "full-fleet",
    name: "Full fleet",
    blurb: "Cart, drill, and crew.",
    hint: "Own all three auto dig upgrades.",
  },
  ...LEVEL_ACHIEVEMENTS.map((l) => ({
    id: l.id,
    name: l.name,
    blurb: l.blurb,
    hint: `Raise ${l.label} to level ${l.level}.`,
  })),
  {
    id: "any-25",
    name: "Specialist",
    blurb: "One upgrade, twenty-five times.",
    hint: "Raise any upgrade to level 25.",
  },
  {
    id: "any-50",
    name: "Obsessed",
    blurb: "Fifty levels into a single upgrade.",
    hint: "Raise any upgrade to level 50.",
  },
  {
    id: "levels-100",
    name: "Century",
    blurb: "A hundred upgrade levels combined.",
    hint: "Reach 100 total upgrade levels.",
  },
  {
    id: "afk-digger",
    name: "AFK digger",
    blurb: "Depth gained without a tap.",
    hint: "Let auto dig advance depth.",
  },
  {
    id: "dirt-hoarder",
    name: "Dirt hoarder",
    blurb: "A thousand dirt in the bank.",
    hint: "Hold 1 000 dirt.",
  },
  {
    id: "overnight",
    name: "Overnight dig",
    blurb: "Back from being away.",
    hint: "Claim offline progress.",
  },
  {
    id: "first-find",
    name: "First find",
    blurb: "Something interesting underground.",
    hint: "Unlock a discovery.",
  },
  {
    id: "collector",
    name: "Collector",
    blurb: "Five finds in the catalog.",
    hint: "Unlock 5 discoveries.",
  },
  {
    id: "museum",
    name: "Museum",
    blurb: "Every discovery unlocked.",
    hint: "Complete the discovery catalog.",
  },
  {
    id: "first-mineshaft",
    name: "Side tunnel",
    blurb: "Rails in the dark.",
    hint: "Reach an abandoned side mineshaft.",
  },
  {
    id: "carts-3",
    name: "Rolling stock",
    blurb: "Three carts along the rails.",
    hint: "Spot 3 minecarts in side shafts.",
  },
  {
    id: "carts-10",
    name: "Rail yard",
    blurb: "A dozen carts would be showing off — ten will do.",
    hint: "Spot 10 minecarts in side shafts.",
  },
];

const DEF_IDS = new Set(ACHIEVEMENT_DEFS.map((d) => d.id));

export function emptyAchievementProgress(): AchievementProgress {
  return {
    unlocked: [],
    afkDigSeen: false,
    overnightClaimed: false,
    mineshaftSeen: false,
    seenMinecarts: [],
    claimedMinecarts: [],
    claimedBarrels: [],
    claimedCrates: [],
  };
}

function normalizeIdList(raw: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(raw)) return out;
  for (const id of raw) {
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function normalizeAchievements(raw: unknown): AchievementProgress {
  const empty = emptyAchievementProgress();
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const unlocked: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(o.unlocked)) {
    for (const id of o.unlocked) {
      if (typeof id !== "string" || !DEF_IDS.has(id) || seen.has(id)) continue;
      seen.add(id);
      unlocked.push(id);
    }
  }
  return {
    unlocked,
    afkDigSeen: o.afkDigSeen === true,
    overnightClaimed: o.overnightClaimed === true,
    mineshaftSeen: o.mineshaftSeen === true,
    seenMinecarts: normalizeIdList(o.seenMinecarts),
    claimedMinecarts: normalizeIdList(o.claimedMinecarts),
    claimedBarrels: normalizeIdList(o.claimedBarrels),
    claimedCrates: normalizeIdList(o.claimedCrates),
  };
}

export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENT_DEFS.find((d) => d.id === id);
}

function layerRank(id: GeoLayerId): number {
  const order: GeoLayerId[] = [
    "soil",
    "clay",
    "bedrock",
    "deep_crust",
    "ancient",
    "abyss",
  ];
  return order.indexOf(id);
}

function isMet(state: AchievementEvalState, id: string): boolean {
  const depth = state.depth.toNumber();
  const layer = geoLayerAt(depth);
  const finds = state.discoveries.unlocked.length;
  const u = state.upgrades;
  const anyUpgrade = UPGRADE_IDS.some((k) => u[k] > 0);
  const maxLevel = Math.max(...UPGRADE_IDS.map((k) => u[k]));
  const totalLevels = UPGRADE_IDS.reduce((sum, k) => sum + u[k], 0);

  const levelDef = LEVEL_ACHIEVEMENTS.find((l) => l.id === id);
  if (levelDef) return u[levelDef.upgradeId] >= levelDef.level;

  switch (id) {
    case "first-dig":
      return depth > 0;
    case "depth-10":
      return depth >= 10;
    case "depth-100":
      return depth >= 100;
    case "depth-1k":
      return depth >= 1_000;
    case "depth-10k":
      return depth >= 10_000;
    case "depth-100k":
      return depth >= 100_000;
    case "depth-1m":
      return depth >= 1_000_000;
    case "depth-10m":
      return depth >= 10_000_000;
    case "layer-clay":
    case "layer-bedrock":
    case "layer-deep_crust":
    case "layer-ancient":
    case "layer-abyss": {
      const target = LAYER_ACHIEVEMENTS.find((l) => l.id === id)!;
      return layerRank(layer.id) >= layerRank(target.layerId);
    }
    case "first-purchase":
      return anyUpgrade;
    case "own-shovel":
      return u.shovel >= 1;
    case "own-pickaxe":
      return u.pickaxe >= 1;
    case "own-jackhammer":
      return u.jackhammer >= 1;
    case "full-kit":
      return u.shovel >= 1 && u.pickaxe >= 1 && u.jackhammer >= 1;
    case "cart-crew":
      return u.cart >= 1 || u.drill >= 1 || u.crew >= 1;
    case "own-drill":
      return u.drill >= 1;
    case "own-crew":
      return u.crew >= 1;
    case "full-fleet":
      return u.cart >= 1 && u.drill >= 1 && u.crew >= 1;
    case "any-25":
      return maxLevel >= 25;
    case "any-50":
      return maxLevel >= 50;
    case "levels-100":
      return totalLevels >= 100;
    case "afk-digger":
      return state.achievements.afkDigSeen;
    case "dirt-hoarder":
      return state.dirt.gte(1000);
    case "overnight":
      return state.achievements.overnightClaimed;
    case "first-find":
      return finds >= 1;
    case "collector":
      return finds >= 5;
    case "museum":
      return finds >= DISCOVERY_DEFS.length;
    case "first-mineshaft":
      return state.achievements.mineshaftSeen;
    case "carts-3":
      return state.achievements.seenMinecarts.length >= 3;
    case "carts-10":
      return state.achievements.seenMinecarts.length >= 10;
    default:
      return false;
  }
}

/**
 * Unlock any newly met achievements. Mutates `state.achievements.unlocked`.
 * @returns newly unlocked ids (catalog order).
 */
export function evaluateAchievements(state: AchievementEvalState): string[] {
  const owned = new Set(state.achievements.unlocked);
  const newly: string[] = [];
  for (const def of ACHIEVEMENT_DEFS) {
    if (owned.has(def.id)) continue;
    if (!isMet(state, def.id)) continue;
    state.achievements.unlocked.push(def.id);
    owned.add(def.id);
    newly.push(def.id);
  }
  return newly;
}

/** Mark that passive dig advanced depth (for `afk-digger`). */
export function noteAfkDig(state: AchievementEvalState): void {
  state.achievements.afkDigSeen = true;
}

/** Mark that offline progress was claimed (for `overnight`). */
export function noteOvernightClaim(state: AchievementEvalState): void {
  state.achievements.overnightClaimed = true;
}

/** First time a side mineshaft loads near the dig face. */
export function noteMineshaftSeen(state: AchievementEvalState): void {
  state.achievements.mineshaftSeen = true;
}

/**
 * Record unique minecart sightings. Returns how many ids were new all-time.
 */
export function noteMinecartsSeen(
  state: AchievementEvalState,
  cartIds: readonly string[],
): number {
  const have = new Set(state.achievements.seenMinecarts);
  let added = 0;
  for (const id of cartIds) {
    if (!id || have.has(id)) continue;
    have.add(id);
    state.achievements.seenMinecarts.push(id);
    added += 1;
  }
  return added;
}

/** Whether this minecart has already been looted. */
export function isMinecartClaimed(
  state: AchievementEvalState,
  cartId: string,
): boolean {
  return state.achievements.claimedMinecarts.includes(cartId);
}

/** Record a minecart loot claim (idempotent). */
export function noteMinecartClaimed(
  state: AchievementEvalState,
  cartId: string,
): boolean {
  if (state.achievements.claimedMinecarts.includes(cartId)) return false;
  state.achievements.claimedMinecarts.push(cartId);
  return true;
}

/** Record a barrel loot claim (idempotent). */
export function noteBarrelClaimed(
  state: AchievementEvalState,
  barrelId: string,
): boolean {
  if (state.achievements.claimedBarrels.includes(barrelId)) return false;
  state.achievements.claimedBarrels.push(barrelId);
  return true;
}

/** Record a crate loot claim (idempotent). */
export function noteCrateClaimed(
  state: AchievementEvalState,
  crateId: string,
): boolean {
  if (state.achievements.claimedCrates.includes(crateId)) return false;
  state.achievements.claimedCrates.push(crateId);
  return true;
}
