/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Tracks which collection entries the player has opened in the HUD tabs.
 * Unseen unlocks show a tab dot (not a count).
 */

import type { GameState } from "./gameState.js";

export interface PanelSeenProgress {
  discoveries: string[];
  specialCoins: string[];
  achievements: string[];
}

/** Tabs that clear an unseen dot when opened. */
export type PanelSeenTab = "collection" | "coins" | "achievements";

export function emptyPanelSeen(): PanelSeenProgress {
  return { discoveries: [], specialCoins: [], achievements: [] };
}

/** Seen = currently unlocked (used when migrating older saves). */
export function panelSeenFromUnlocked(state: {
  discoveries: { unlocked: readonly string[] };
  specialCoins: { unlocked: readonly string[] };
  achievements: { unlocked: readonly string[] };
}): PanelSeenProgress {
  return {
    discoveries: [...state.discoveries.unlocked],
    specialCoins: [...state.specialCoins.unlocked],
    achievements: [...state.achievements.unlocked],
  };
}

function normalizeIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of raw) {
    if (typeof id !== "string" || id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function normalizePanelSeen(raw: unknown): PanelSeenProgress {
  if (!raw || typeof raw !== "object") return emptyPanelSeen();
  const o = raw as Record<string, unknown>;
  return {
    discoveries: normalizeIdList(o.discoveries),
    specialCoins: normalizeIdList(o.specialCoins),
    achievements: normalizeIdList(o.achievements),
  };
}

export function hasUnseen(
  unlocked: readonly string[],
  seen: readonly string[],
): boolean {
  if (unlocked.length === 0) return false;
  const viewed = new Set(seen);
  return unlocked.some((id) => !viewed.has(id));
}

/** Copy unlocked → seen for one catalog. Returns true if the seen list changed. */
export function markUnlockedSeen(
  unlocked: readonly string[],
  seen: string[],
): boolean {
  if (
    unlocked.length === seen.length &&
    unlocked.every((id, i) => id === seen[i])
  ) {
    return false;
  }
  seen.length = 0;
  seen.push(...unlocked);
  return true;
}

function isPanelSeenTab(tab: string): tab is PanelSeenTab {
  return tab === "collection" || tab === "coins" || tab === "achievements";
}

/** Mark the open collection tab's catalog as viewed. */
export function markPanelTabSeen(state: GameState, tab: string): boolean {
  if (!isPanelSeenTab(tab)) return false;
  if (tab === "collection") {
    return markUnlockedSeen(
      state.discoveries.unlocked,
      state.panelSeen.discoveries,
    );
  }
  if (tab === "coins") {
    return markUnlockedSeen(
      state.specialCoins.unlocked,
      state.panelSeen.specialCoins,
    );
  }
  return markUnlockedSeen(
    state.achievements.unlocked,
    state.panelSeen.achievements,
  );
}
