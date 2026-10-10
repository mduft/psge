/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it, vi } from "vitest";
import { createMemorySaveStore } from "@psge/engine";
import { createAutosave } from "../src/autosave.js";
import { createInitialState } from "../src/gameState.js";
import { loadGameState } from "../src/persist.js";

describe("createAutosave", () => {
  it("debounces then persists", async () => {
    const store = createMemorySaveStore();
    const state = createInitialState({ depth: 3, dirt: 12 });
    const timers = new Map<number, { fn: () => void; ms: number }>();
    let nextId = 1;
    let now = 0;

    const autosave = createAutosave({
      store,
      getState: () => state,
      debounceMs: 1000,
      maxIntervalMs: 30_000,
      now: () => now,
      setTimeout: (fn, ms) => {
        const id = nextId++;
        timers.set(id, { fn, ms });
        return id;
      },
      clearTimeout: (id) => {
        timers.delete(id);
      },
    });

    autosave.markDirty();
    expect(await store.load()).toBeNull();
    expect(timers.size).toBe(2);

    now = 1000;
    const debounce = [...timers.values()].find((t) => t.ms === 1000);
    expect(debounce).toBeTruthy();
    debounce!.fn();

    await vi.waitFor(async () => {
      const loaded = await loadGameState(store);
      expect(loaded?.depth.toNumber()).toBe(3);
    });

    autosave.dispose();
  });

  it("flush awaits in-flight save and skips when clean", async () => {
    const store = createMemorySaveStore();
    const state = createInitialState({ depth: 1, dirt: 4 });
    let resolveSave: (() => void) | undefined;
    const slowStore = {
      async load() {
        return store.load();
      },
      async save(data: unknown) {
        await new Promise<void>((r) => {
          resolveSave = r;
        });
        await store.save(data);
      },
      async clear() {
        return store.clear();
      },
    };

    const autosave = createAutosave({
      store: slowStore,
      getState: () => state,
      debounceMs: 1000,
      maxIntervalMs: 30_000,
      setTimeout: () => 1,
      clearTimeout: () => undefined,
    });

    autosave.markDirty();
    const flushPromise = autosave.flush();
    expect(resolveSave).toBeTypeOf("function");
    resolveSave!();
    await flushPromise;

    const loaded = await loadGameState(store);
    expect(loaded?.depth.toNumber()).toBe(1);

    await autosave.flush();
    autosave.dispose();
  });

  it("re-arms timers when save fails", async () => {
    let fail = true;
    const store = createMemorySaveStore();
    const state = createInitialState({ depth: 2, dirt: 8 });
    const timers = new Map<number, { fn: () => void; ms: number }>();
    let nextId = 1;
    let now = 0;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const flaky = {
      load: () => store.load(),
      clear: () => store.clear(),
      async save(data: unknown) {
        if (fail) throw new Error("disk full");
        await store.save(data);
      },
    };

    const autosave = createAutosave({
      store: flaky,
      getState: () => state,
      debounceMs: 1000,
      maxIntervalMs: 30_000,
      now: () => now,
      setTimeout: (fn, ms) => {
        const id = nextId++;
        timers.set(id, { fn, ms });
        return id;
      },
      clearTimeout: (id) => {
        timers.delete(id);
      },
    });

    autosave.markDirty();
    now = 1000;
    const first = [...timers.values()].find((t) => t.ms === 1000)!;
    first.fn();

    await vi.waitFor(() => {
      expect(timers.size).toBeGreaterThan(0);
    });

    fail = false;
    now = 2000;
    const retry = [...timers.values()].find((t) => t.ms <= 1000);
    expect(retry).toBeTruthy();
    retry!.fn();

    await vi.waitFor(async () => {
      const loaded = await loadGameState(store);
      expect(loaded?.depth.toNumber()).toBe(2);
    });

    autosave.dispose();
    spy.mockRestore();
  });
});
