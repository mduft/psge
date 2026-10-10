/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import { digToolOf } from "../src/digCursor.js";
import { emptyUpgrades } from "../src/upgrades.js";

describe("digToolOf", () => {
  it("starts as spoon with no dig upgrades", () => {
    expect(digToolOf(emptyUpgrades())).toBe("spoon");
    expect(digToolOf({ ...emptyUpgrades(), cart: 3 })).toBe("spoon");
  });

  it("uses the highest dig-tool tier owned", () => {
    expect(digToolOf({ ...emptyUpgrades(), shovel: 1 })).toBe("shovel");
    expect(digToolOf({ ...emptyUpgrades(), shovel: 2, pickaxe: 1 })).toBe(
      "pickaxe",
    );
    expect(
      digToolOf({ ...emptyUpgrades(), shovel: 1, pickaxe: 1, jackhammer: 1 }),
    ).toBe("jackhammer");
  });
});
