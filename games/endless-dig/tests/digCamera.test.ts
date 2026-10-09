/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import { digCameraFraming } from "../src/digCamera.js";

describe("digCameraFraming", () => {
  it("pulls back on portrait and moves closer on wide aspects", () => {
    const phone = digCameraFraming(0.5);
    const square = digCameraFraming(1);
    const landscape = digCameraFraming(1.4);
    const fullHd = digCameraFraming(16 / 9);
    const ultra = digCameraFraming(2.4);

    expect(phone.distance).toBeGreaterThan(square.distance);
    expect(square.distance).toBeGreaterThan(landscape.distance);
    expect(landscape.distance).toBeGreaterThan(fullHd.distance);
    expect(fullHd.distance).toBeGreaterThan(ultra.distance);
  });

  it("uses stable framing for full HD", () => {
    expect(digCameraFraming(1920 / 1080)).toEqual({
      distance: 20,
      xOffset: 3.0,
      panXBlocks: -0.7,
    });
  });
});
