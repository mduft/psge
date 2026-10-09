/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import { decideAutosave } from "../src/autosavePolicy.js";

describe("decideAutosave", () => {
  it("waits until debounce elapses", () => {
    expect(
      decideAutosave({
        now: 500,
        lastChangeAt: 0,
        dirtySince: 0,
        debounceMs: 1000,
        maxIntervalMs: 30_000,
      }),
    ).toBe("wait");
    expect(
      decideAutosave({
        now: 1000,
        lastChangeAt: 0,
        dirtySince: 0,
        debounceMs: 1000,
        maxIntervalMs: 30_000,
      }),
    ).toBe("debounce-ready");
  });

  it("forces save after max interval even if debounce keeps resetting", () => {
    expect(
      decideAutosave({
        now: 30_000,
        lastChangeAt: 29_500,
        dirtySince: 0,
        debounceMs: 1000,
        maxIntervalMs: 30_000,
      }),
    ).toBe("max-interval");
  });
});
