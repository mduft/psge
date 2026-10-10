/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Milestone 9 — durable meta unlocks (celebration chrome, not dig power).
 */
import Decimal from "decimal.js";
import { DISCOVERY_DEFS } from "./discoveries.js";
import { geoLayerAt, type GeoLayerId } from "./geoLayers.js";
import { UPGRADE_IDS, type UpgradeLevels } from "./upgrades.js";

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
];

const DEF_IDS = new Set(ACHIEVEMENT_DEFS.map((d) => d.id));

export function emptyAchievementProgress(): AchievementProgress {
  return { unlocked: [], afkDigSeen: false, overnightClaimed: false };
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
