/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import Decimal from "decimal.js";

/**
 * Base dig power in blocks per tap (~one screen pixel of descent at M2 framing).
 * Upgrade steps are multiples of this so early buys feel like doubling.
 */
export const DEFAULT_DIG_POWER = 1 / 32;

export const UPGRADE_IDS = [
  "shovel",
  "pickaxe",
  "jackhammer",
  "cart",
  "drill",
  "crew",
] as const;

export type UpgradeId = (typeof UPGRADE_IDS)[number];

export type UpgradeLevels = Record<UpgradeId, number>;

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** Dig power added per level (blocks per tap). */
  digPowerPerLevel: number;
  /** Passive depth per second added per level. */
  passivePerLevel: number;
  baseCost: number;
  costMult: number;
  effectLabel: string;
}

/**
 * Dig-power steps are multiples of base `1/32` so early buys feel like
 * doubling / a few taps faster — not suddenly half a block per tap.
 */
export const UPGRADE_DEFS: readonly UpgradeDef[] = [
  {
    id: "shovel",
    name: "Shovel",
    digPowerPerLevel: DEFAULT_DIG_POWER, // +1/32 → first buy doubles
    passivePerLevel: 0,
    baseCost: 20,
    costMult: 1.45,
    effectLabel: "+1/32 dig",
  },
  {
    id: "pickaxe",
    name: "Pickaxe",
    digPowerPerLevel: 2 * DEFAULT_DIG_POWER, // +2/32
    passivePerLevel: 0,
    baseCost: 250,
    costMult: 1.55,
    effectLabel: "+2/32 dig",
  },
  {
    id: "jackhammer",
    name: "Jackhammer",
    digPowerPerLevel: 8 * DEFAULT_DIG_POWER, // +8/32 = +0.25
    passivePerLevel: 0,
    baseCost: 2_000,
    costMult: 1.65,
    effectLabel: "+8/32 dig",
  },
  {
    id: "cart",
    name: "Hand cart",
    digPowerPerLevel: 0,
    passivePerLevel: 0.05,
    baseCost: 100,
    costMult: 1.5,
    effectLabel: "+0.05/s",
  },
  {
    id: "drill",
    name: "Drill",
    digPowerPerLevel: 0,
    passivePerLevel: 0.5,
    baseCost: 5_000,
    costMult: 1.6,
    effectLabel: "+0.5/s",
  },
  {
    id: "crew",
    name: "Dig crew",
    digPowerPerLevel: 0,
    passivePerLevel: 3,
    baseCost: 40_000,
    costMult: 1.7,
    effectLabel: "+3/s",
  },
] as const;

export function emptyUpgrades(): UpgradeLevels {
  return {
    shovel: 0,
    pickaxe: 0,
    jackhammer: 0,
    cart: 0,
    drill: 0,
    crew: 0,
  };
}

export function normalizeUpgrades(
  raw: Partial<Record<string, unknown>> | undefined,
): UpgradeLevels {
  const out = emptyUpgrades();
  if (!raw || typeof raw !== "object") return out;
  for (const id of UPGRADE_IDS) {
    const v = raw[id];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[id] = Math.floor(v);
    }
  }
  return out;
}

export function getUpgradeDef(id: UpgradeId): UpgradeDef {
  const def = UPGRADE_DEFS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown upgrade: ${id}`);
  return def;
}

/** Cost to buy the next level (`level` = current owned count). */
export function upgradeCost(id: UpgradeId, level: number): Decimal {
  const def = getUpgradeDef(id);
  const lv = Math.max(0, Math.floor(level));
  return new Decimal(def.baseCost)
    .mul(new Decimal(def.costMult).pow(lv))
    .floor();
}
