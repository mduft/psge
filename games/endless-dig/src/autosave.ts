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
  /** Injectable timer APIs for unit tests (defaults to window). */
  setTimeout?: (fn: () => void, ms: number) => number;
  clearTimeout?: (id: number) => void;
}

/**
 * 1s debounce after last change; force save at least every 30s while dirty.
 */
export function createAutosave(options: AutosaveOptions): AutosaveController {
  const debounceMs = options.debounceMs ?? DEFAULT_AUTOSAVE_DEBOUNCE_MS;
  const maxIntervalMs = options.maxIntervalMs ?? DEFAULT_AUTOSAVE_MAX_INTERVAL_MS;
  const now = options.now ?? (() => performance.now());
  const schedule =
    options.setTimeout ??
    ((fn, ms) => window.setTimeout(fn, ms) as unknown as number);
  const cancel =
    options.clearTimeout ?? ((id) => window.clearTimeout(id));

  let dirty = false;
  let lastChangeAt = 0;
  let dirtySince = 0;
  let debounceTimer = 0;
  let maxTimer = 0;
  let saving: Promise<void> | null = null;

  const clearTimers = (): void => {
    if (debounceTimer !== 0) {
      cancel(debounceTimer);
      debounceTimer = 0;
    }
    if (maxTimer !== 0) {
      cancel(maxTimer);
      maxTimer = 0;
    }
  };

  const performSave = async (): Promise<void> => {
    // Wait for an in-flight save (pagehide must not skip it).
    if (saving) {
      try {
        await saving;
      } catch {
        // Prior attempt failed; fall through if still dirty.
      }
    }
    if (!dirty) return;

    clearTimers();
    dirty = false;
    saving = (async () => {
      try {
        await saveGameState(options.store, options.getState());
        options.onSaved?.();
      } catch (err) {
        dirty = true;
        // Do not clobber newer timestamps from markDirty during the attempt.
        armTimers();
        throw err;
      } finally {
        saving = null;
      }
    })();
    await saving;
  };

  const armTimers = (): void => {
    if (!dirty) return;
    clearTimers();
    const t0 = now();
    const decision = decideAutosave({
      now: t0,
      lastChangeAt,
      dirtySince,
      debounceMs,
      maxIntervalMs,
    });
    // Schedule a turn later so a failure inside performSave does not recurse.
    const untilDebounce = Math.max(0, debounceMs - (t0 - lastChangeAt));
    const untilMax = Math.max(0, maxIntervalMs - (t0 - dirtySince));
    const delay =
      decision === "max-interval" || decision === "debounce-ready"
        ? 0
        : Math.min(untilDebounce, untilMax);
    debounceTimer = schedule(() => {
      debounceTimer = 0;
      void performSave().catch((err) => console.error(err));
    }, delay);
    if (decision !== "max-interval" && decision !== "debounce-ready") {
      maxTimer = schedule(() => {
        maxTimer = 0;
        void performSave().catch((err) => console.error(err));
      }, untilMax);
    }
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
