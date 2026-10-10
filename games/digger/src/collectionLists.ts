/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Discovery + special-coin + achievement collection sheet row builders.
 *
 * Lists are rebuilt only when the unlock signature changes — `updateHud` runs
 * every frame, and Chrome scroll-anchoring jumps to the bottom if we churn
 * the DOM while the user has scrolled.
 */
import { ACHIEVEMENT_DEFS } from "./achievements.js";
import { DISCOVERY_DEFS } from "./discoveries.js";
import {
  createAchievementIconImg,
  createCoinIconImg,
  createDiscoveryIconImg,
} from "./icons.js";
import { SPECIAL_COIN_DEFS } from "./specialCoins.js";

const lastSig = new WeakMap<HTMLElement, string>();

function unlockSig(ids: readonly string[]): string {
  return ids.join("\0");
}

/** Skip a no-op rebuild; returns true when the list still needs painting. */
function needsRebuild(
  list: HTMLElement,
  unlockedIds: readonly string[],
): boolean {
  const sig = unlockSig(unlockedIds);
  if (lastSig.get(list) === sig && list.childElementCount > 0) return false;
  lastSig.set(list, sig);
  return true;
}

export function refreshDiscoveryList(
  list: HTMLElement | null,
  unlockedIds: readonly string[],
): void {
  if (!list || !needsRebuild(list, unlockedIds)) return;
  const owned = new Set(unlockedIds);
  list.replaceChildren();
  for (const def of DISCOVERY_DEFS) {
    const unlocked = owned.has(def.id);
    const row = document.createElement("div");
    row.className = `collection-row${unlocked ? "" : " is-locked"}`;
    row.dataset.discovery = def.id;
    row.dataset.unlocked = unlocked ? "1" : "0";

    const icon = createDiscoveryIconImg(def.icon);
    if (!unlocked) icon.classList.add("is-locked");

    const meta = document.createElement("div");
    meta.className = "collection-meta";
    const name = document.createElement("span");
    name.className = "collection-name";
    name.textContent = unlocked ? def.name : "???";
    const blurb = document.createElement("span");
    blurb.className = "collection-blurb";
    blurb.textContent = unlocked ? def.blurb : "Keep digging.";
    meta.append(name, blurb);

    row.append(icon, meta);
    list.append(row);
  }
}

export function refreshSpecialCoinsList(
  list: HTMLElement | null,
  unlockedIds: readonly string[],
): void {
  if (!list || !needsRebuild(list, unlockedIds)) return;
  const owned = new Set(unlockedIds);
  list.replaceChildren();
  for (const def of SPECIAL_COIN_DEFS) {
    const unlocked = owned.has(def.id);
    const row = document.createElement("div");
    row.className = `collection-row${unlocked ? "" : " is-locked"}`;
    row.dataset.specialCoin = def.id;
    row.dataset.unlocked = unlocked ? "1" : "0";

    const mark = createCoinIconImg(
      unlocked,
      unlocked ? `#${def.tint.toString(16).padStart(6, "0")}` : undefined,
    );

    const meta = document.createElement("div");
    meta.className = "collection-meta";
    const name = document.createElement("span");
    name.className = "collection-name";
    name.textContent = unlocked ? def.name : "???";
    const blurb = document.createElement("span");
    blurb.className = "collection-blurb";
    blurb.textContent = unlocked ? def.blurb : "Rare — dig deeper.";
    meta.append(name, blurb);

    row.append(mark, meta);
    list.append(row);
  }
}

export function refreshAchievementsList(
  list: HTMLElement | null,
  unlockedIds: readonly string[],
): void {
  if (!list || !needsRebuild(list, unlockedIds)) return;
  const owned = new Set(unlockedIds);
  list.replaceChildren();
  for (const def of ACHIEVEMENT_DEFS) {
    const unlocked = owned.has(def.id);
    const row = document.createElement("div");
    row.className = `collection-row${unlocked ? "" : " is-locked"}`;
    row.dataset.achievement = def.id;
    row.dataset.unlocked = unlocked ? "1" : "0";

    const mark = createAchievementIconImg(unlocked);

    const meta = document.createElement("div");
    meta.className = "collection-meta";
    const name = document.createElement("span");
    name.className = "collection-name";
    name.textContent = unlocked ? def.name : "???";
    const blurb = document.createElement("span");
    blurb.className = "collection-blurb";
    blurb.textContent = unlocked ? def.blurb : def.hint;
    meta.append(name, blurb);

    row.append(mark, meta);
    list.append(row);
  }
}
