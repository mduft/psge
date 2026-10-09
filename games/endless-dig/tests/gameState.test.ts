/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import {
  createInitialState,
  dig,
  DEFAULT_DIG_POWER,
  SHAFT_CROSS_SECTION,
} from "../src/gameState.js";

describe("dig", () => {
  it("increases depth by digPower and dirt by cross-section", () => {
    const state = createInitialState({ digPower: 0.5 });
    dig(state);
    expect(state.depth).toBeCloseTo(0.5);
    expect(state.dirt).toBeCloseTo(0.5 * SHAFT_CROSS_SECTION);
  });

  it("uses default dig power from createInitialState", () => {
    const state = createInitialState();
    dig(state);
    expect(state.depth).toBeCloseTo(DEFAULT_DIG_POWER);
  });

  it("caps depth at maxDepth", () => {
    const state = createInitialState({ digPower: 10, depth: 8 });
    dig(state, 10);
    expect(state.depth).toBe(10);
    expect(state.dirt).toBeCloseTo(2 * SHAFT_CROSS_SECTION);
  });

  it("is deterministic across many digs", () => {
    const state = createInitialState({ digPower: 0.25 });
    for (let i = 0; i < 40; i++) dig(state);
    expect(state.depth).toBeCloseTo(10);
    expect(state.dirt).toBeCloseTo(10 * SHAFT_CROSS_SECTION);
  });
});
