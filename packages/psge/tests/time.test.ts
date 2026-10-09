/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import { clampDelta, DEFAULT_MAX_DELTA } from "../src/time.js";

describe("clampDelta", () => {
  it("passes through normal frame deltas", () => {
    expect(clampDelta(1 / 60)).toBeCloseTo(1 / 60);
  });

  it("clamps pathological pauses", () => {
    expect(clampDelta(5)).toBe(DEFAULT_MAX_DELTA);
  });

  it("treats non-finite or negative values as zero", () => {
    expect(clampDelta(Number.NaN)).toBe(0);
    expect(clampDelta(-0.1)).toBe(0);
  });
});
