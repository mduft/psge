/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import {
  cavityStructureKey,
  digFaceWearLevel,
  quantizeExcavatedDepth,
  quantizePartialHeight,
  shaftBlockRemainHeight,
} from "../src/world.js";

describe("shaftBlockRemainHeight", () => {
  it("leaves all blocks intact at depth 0", () => {
    expect(shaftBlockRemainHeight(0, 0)).toBe(1);
    expect(shaftBlockRemainHeight(-1, 0)).toBe(1);
  });

  it("shrinks the dig-face block for fractional depth", () => {
    expect(shaftBlockRemainHeight(0, 0.25)).toBeCloseTo(0.75);
    expect(shaftBlockRemainHeight(-1, 0.25)).toBe(1);
  });

  it("removes completed layers and partials the next", () => {
    expect(shaftBlockRemainHeight(0, 1.25)).toBe(0);
    expect(shaftBlockRemainHeight(-1, 1.25)).toBeCloseTo(0.75);
    expect(shaftBlockRemainHeight(-2, 1.25)).toBe(1);
  });

  it("removes exact integer depths with no partial left", () => {
    expect(shaftBlockRemainHeight(0, 2)).toBe(0);
    expect(shaftBlockRemainHeight(-1, 2)).toBe(0);
    expect(shaftBlockRemainHeight(-2, 2)).toBe(1);
  });
});

describe("quantizePartialHeight", () => {
  it("snaps to 1/32 grid", () => {
    expect(quantizePartialHeight(0.25)).toBe(0.25);
    expect(quantizePartialHeight(0.26)).toBeCloseTo(8 / 32);
    expect(quantizePartialHeight(1 / 32)).toBeCloseTo(1 / 32);
  });

  it("matches dig-face remain height after dig power steps", () => {
    const remain = shaftBlockRemainHeight(0, 5 / 32);
    expect(quantizePartialHeight(remain)).toBeCloseTo(remain);
  });
});

describe("quantizeExcavatedDepth", () => {
  it("snaps to 1/32 and clamps non-positive", () => {
    expect(quantizeExcavatedDepth(0)).toBe(0);
    expect(quantizeExcavatedDepth(5 / 32)).toBeCloseTo(5 / 32);
    expect(quantizeExcavatedDepth(0.26)).toBeCloseTo(8 / 32);
  });
});

describe("cavityStructureKey", () => {
  it("stays stable while digging through the same partial block", () => {
    expect(cavityStructureKey(0.1)).toBe(cavityStructureKey(0.9));
    expect(cavityStructureKey(1.1)).toBe(cavityStructureKey(1.5));
  });

  it("changes when a layer is completed or a partial begins", () => {
    expect(cavityStructureKey(1)).not.toBe(cavityStructureKey(1.1));
    expect(cavityStructureKey(0)).not.toBe(cavityStructureKey(0.1));
    expect(cavityStructureKey(0.9)).not.toBe(cavityStructureKey(1));
  });
});

describe("digFaceWearLevel", () => {
  it("is coarse (0…7) and stable within a band", () => {
    expect(digFaceWearLevel(1)).toBe(0);
    // 28/32 and 25/32 both sit in wear band 1 (dug 4…7).
    expect(digFaceWearLevel(28 / 32)).toBe(1);
    expect(digFaceWearLevel(25 / 32)).toBe(1);
    expect(digFaceWearLevel(1 / 32)).toBe(7);
  });
});
