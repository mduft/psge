/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */

export interface SaveStore {
  load(): Promise<unknown | null>;
  save(data: unknown): Promise<void>;
  clear(): Promise<void>;
}

export interface LocalSaveStoreOptions {
  /** localStorage key. */
  key: string;
  /** Inject storage for tests. Defaults to `globalThis.localStorage`. */
  storage?: Storage;
}

/**
 * Browser localStorage-backed save store. API is async; I/O is synchronous.
 */
export function createLocalSaveStore(
  options: LocalSaveStoreOptions,
): SaveStore {
  const { key } = options;
  const storage = options.storage ?? globalThis.localStorage;

  return {
    async load(): Promise<unknown | null> {
      const raw = storage.getItem(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    },

    async save(data: unknown): Promise<void> {
      storage.setItem(key, JSON.stringify(data));
    },

    async clear(): Promise<void> {
      storage.removeItem(key);
    },
  };
}

/** In-memory store for unit tests (no DOM). */
export function createMemorySaveStore(
  initial: unknown | null = null,
): SaveStore {
  let slot: unknown | null = initial;
  return {
    async load() {
      return slot;
    },
    async save(data) {
      slot = data;
    },
    async clear() {
      slot = null;
    },
  };
}
