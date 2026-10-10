/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  initAudio,
  isMuted,
  MUTE_STORAGE_KEY,
  setMuted,
  toggleMuted,
} from "../src/audio.js";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  });
  setMuted(false);
});

afterEach(() => {
  store.clear();
  setMuted(false);
});

describe("audio mute preference", () => {
  it("defaults unmuted", () => {
    expect(initAudio()).toBe(false);
    expect(isMuted()).toBe(false);
  });

  it("persists mute across init", () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(store.get(MUTE_STORAGE_KEY)).toBe("1");
    expect(initAudio()).toBe(true);
    expect(isMuted()).toBe(true);
  });

  it("toggle clears storage when unmuted", () => {
    setMuted(true);
    expect(toggleMuted()).toBe(false);
    expect(store.has(MUTE_STORAGE_KEY)).toBe(false);
  });
});
