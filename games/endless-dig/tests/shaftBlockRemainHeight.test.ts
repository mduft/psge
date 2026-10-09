/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import { shaftBlockRemainHeight } from "../src/world.js";

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
