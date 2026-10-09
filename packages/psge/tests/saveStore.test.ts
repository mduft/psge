/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import {
  createLocalSaveStore,
  createMemorySaveStore,
} from "../src/saveStore.js";

describe("createMemorySaveStore", () => {
  it("round-trips and clears", async () => {
    const store = createMemorySaveStore();
    expect(await store.load()).toBeNull();
    await store.save({ version: 2, depth: 3 });
    expect(await store.load()).toEqual({ version: 2, depth: 3 });
    await store.clear();
    expect(await store.load()).toBeNull();
  });
});

describe("createLocalSaveStore", () => {
  it("uses injected Storage", async () => {
    const map = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        map.set(k, v);
      },
      removeItem: (k) => {
        map.delete(k);
      },
      key: (i) => [...map.keys()][i] ?? null,
    };

    const store = createLocalSaveStore({ key: "test:save", storage });
    await store.save({ a: 1 });
    expect(map.get("test:save")).toBe('{"a":1}');
    expect(await store.load()).toEqual({ a: 1 });
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it("returns null for corrupt JSON", async () => {
    const map = new Map<string, string>([["bad", "{not-json"]]);
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: () => {},
      removeItem: () => {},
    } as Storage;
    const store = createLocalSaveStore({ key: "bad", storage });
    expect(await store.load()).toBeNull();
  });
});
