/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Discovery + special-coin collection sheet row builders.
 */
import { DISCOVERY_DEFS } from "./discoveries.js";
import { SPECIAL_COIN_DEFS } from "./specialCoins.js";

export function refreshDiscoveryList(
  list: HTMLElement | null,
  unlockedIds: readonly string[],
): void {
  if (!list) return;
  const owned = new Set(unlockedIds);
  list.replaceChildren();
  for (const def of DISCOVERY_DEFS) {
    const unlocked = owned.has(def.id);
    const row = document.createElement("div");
    row.className = `collection-row${unlocked ? "" : " is-locked"}`;
    row.dataset.discovery = def.id;
    row.dataset.unlocked = unlocked ? "1" : "0";

    const icon = document.createElement("span");
    icon.className = `discovery-icon icon-${def.icon}`;
    icon.setAttribute("aria-hidden", "true");

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
  if (!list) return;
  const owned = new Set(unlockedIds);
  list.replaceChildren();
  for (const def of SPECIAL_COIN_DEFS) {
    const unlocked = owned.has(def.id);
    const row = document.createElement("div");
    row.className = `collection-row${unlocked ? "" : " is-locked"}`;
    row.dataset.specialCoin = def.id;
    row.dataset.unlocked = unlocked ? "1" : "0";

    const mark = document.createElement("span");
    mark.className = "coin-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = unlocked ? def.mark : "?";
    mark.style.background = unlocked
      ? `#${def.tint.toString(16).padStart(6, "0")}`
      : "#3a4048";

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
