/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import {
  decideAutosave,
  DEFAULT_AUTOSAVE_DEBOUNCE_MS,
  DEFAULT_AUTOSAVE_MAX_INTERVAL_MS,
  type SaveStore,
} from "@psge/engine";
import { saveGameState } from "./persist.js";
import type { GameState } from "./gameState.js";

export interface AutosaveController {
  /** Mark state dirty and schedule debounce / max-interval save. */
  markDirty(): void;
  /** Flush immediately if dirty (pagehide / teardown). */
  flush(): Promise<void>;
  dispose(): void;
}

export interface AutosaveOptions {
  store: SaveStore;
  getState: () => GameState;
  onSaved?: () => void;
  debounceMs?: number;
  maxIntervalMs?: number;
  now?: () => number;
}

/**
 * 1s debounce after last change; force save at least every 30s while dirty.
 */
export function createAutosave(options: AutosaveOptions): AutosaveController {
  const debounceMs = options.debounceMs ?? DEFAULT_AUTOSAVE_DEBOUNCE_MS;
  const maxIntervalMs = options.maxIntervalMs ?? DEFAULT_AUTOSAVE_MAX_INTERVAL_MS;
  const now = options.now ?? (() => performance.now());

  let dirty = false;
  let lastChangeAt = 0;
  let dirtySince = 0;
  let debounceTimer = 0;
  let maxTimer = 0;
  let saving: Promise<void> | null = null;

  const clearTimers = (): void => {
    if (debounceTimer !== 0) {
      clearTimeout(debounceTimer);
      debounceTimer = 0;
    }
    if (maxTimer !== 0) {
      clearTimeout(maxTimer);
      maxTimer = 0;
    }
  };

  const performSave = async (): Promise<void> => {
    if (!dirty) return;
    if (saving) {
      await saving;
      if (!dirty) return;
    }
    clearTimers();
    const snapshotDirtySince = dirtySince;
    const snapshotChange = lastChangeAt;
    dirty = false;
    saving = (async () => {
      try {
        await saveGameState(options.store, options.getState());
        options.onSaved?.();
      } catch (err) {
        // Re-dirty if save failed so a later attempt can retry.
        dirty = true;
        dirtySince = snapshotDirtySince;
        lastChangeAt = snapshotChange;
        throw err;
      } finally {
        saving = null;
      }
    })();
    await saving;
  };

  const armTimers = (): void => {
    clearTimers();
    const t0 = now();
    const decision = decideAutosave({
      now: t0,
      lastChangeAt,
      dirtySince,
      debounceMs,
      maxIntervalMs,
    });
    if (decision === "max-interval" || decision === "debounce-ready") {
      void performSave().catch((err) => console.error(err));
      return;
    }
    const untilDebounce = Math.max(0, debounceMs - (t0 - lastChangeAt));
    const untilMax = Math.max(0, maxIntervalMs - (t0 - dirtySince));
    debounceTimer = window.setTimeout(() => {
      debounceTimer = 0;
      void performSave().catch((err) => console.error(err));
    }, untilDebounce);
    maxTimer = window.setTimeout(() => {
      maxTimer = 0;
      void performSave().catch((err) => console.error(err));
    }, untilMax);
  };

  return {
    markDirty(): void {
      const t = now();
      if (!dirty) {
        dirty = true;
        dirtySince = t;
      }
      lastChangeAt = t;
      armTimers();
    },

    async flush(): Promise<void> {
      clearTimers();
      await performSave();
    },

    dispose(): void {
      clearTimers();
    },
  };
}
