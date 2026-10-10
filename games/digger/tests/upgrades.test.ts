/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import {
  emptyUpgrades,
  visibleShopUpgradeIds,
} from "../src/upgrades.js";

describe("visibleShopUpgradeIds", () => {
  it("starts with only the first item in each category", () => {
    expect([...visibleShopUpgradeIds(emptyUpgrades(), 0)]).toEqual([
      "shovel",
      "cart",
    ]);
  });

  it("reveals the next item after an unlock", () => {
    const upgrades = emptyUpgrades();
    upgrades.shovel = 1;
    upgrades.cart = 1;
    expect([...visibleShopUpgradeIds(upgrades, 0)]).toEqual([
      "shovel",
      "pickaxe",
      "cart",
      "drill",
    ]);
  });

  it("reveals affordable later items so progression can be skipped", () => {
    expect([...visibleShopUpgradeIds(emptyUpgrades(), 5_000)]).toEqual([
      "shovel",
      "pickaxe",
      "jackhammer",
      "cart",
      "drill",
    ]);
  });

  it("keeps skipped owned items and the normal next item visible", () => {
    const upgrades = emptyUpgrades();
    upgrades.jackhammer = 1;
    expect([...visibleShopUpgradeIds(upgrades, 0)]).toEqual([
      "shovel",
      "jackhammer",
      "cart",
    ]);
  });
});
