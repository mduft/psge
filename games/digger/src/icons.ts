/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * HUD / collection icons — swap PNGs under assets/textures/icons/ (see README).
 */
import type { DiscoveryIcon } from "./discoveries.js";

import panelMenuUrl from "../assets/textures/icons/ui/panel-menu.png";
import panelCloseUrl from "../assets/textures/icons/ui/panel-close.png";
import tabShopUrl from "../assets/textures/icons/ui/tab-shop.png";
import tabFindsUrl from "../assets/textures/icons/ui/tab-finds.png";
import tabCoinsUrl from "../assets/textures/icons/ui/tab-coins.png";
import tabGoalsUrl from "../assets/textures/icons/ui/tab-goals.png";
import debugUrl from "../assets/textures/icons/ui/debug.png";
import autoPauseUrl from "../assets/textures/icons/ui/auto-pause.png";
import autoPlayUrl from "../assets/textures/icons/ui/auto-play.png";
import trophyUrl from "../assets/textures/icons/ui/trophy.png";
import achievementUrl from "../assets/textures/icons/ui/achievement.png";
import achievementLockedUrl from "../assets/textures/icons/ui/achievement-locked.png";
import coinUrl from "../assets/textures/icons/ui/coin.png";
import lockedUrl from "../assets/textures/icons/ui/locked.png";
import shopUnlockUrl from "../assets/textures/icons/ui/shop-unlock.png";
import shopUpgradeUrl from "../assets/textures/icons/ui/shop-upgrade.png";
import helpUrl from "../assets/textures/icons/ui/help.png";
import soundUrl from "../assets/textures/icons/ui/sound.png";
import soundMuteUrl from "../assets/textures/icons/ui/sound-mute.png";
import spoonUrl from "../assets/textures/cursors/spoon.png";

import boneUrl from "../assets/textures/icons/discoveries/bone.png";
import shardUrl from "../assets/textures/icons/discoveries/shard.png";
import crystalUrl from "../assets/textures/icons/discoveries/crystal.png";
import gearUrl from "../assets/textures/icons/discoveries/gear.png";
import stoneUrl from "../assets/textures/icons/discoveries/stone.png";
import tabletUrl from "../assets/textures/icons/discoveries/tablet.png";
import orbUrl from "../assets/textures/icons/discoveries/orb.png";

/** Static HUD icons referenced via `data-icon` on `<img>`. */
export type UiIconId =
  | "panel-menu"
  | "panel-close"
  | "tab-shop"
  | "tab-finds"
  | "tab-coins"
  | "tab-goals"
  | "debug"
  | "auto-pause"
  | "auto-play"
  | "trophy"
  | "achievement"
  | "achievement-locked"
  | "coin"
  | "locked"
  | "shop-unlock"
  | "shop-upgrade"
  | "help"
  | "sound"
  | "sound-mute"
  /** Starter dig tool — help manual “Dig” section. */
  | "spoon";

const UI_URLS: Record<UiIconId, string> = {
  "panel-menu": panelMenuUrl,
  "panel-close": panelCloseUrl,
  "tab-shop": tabShopUrl,
  "tab-finds": tabFindsUrl,
  "tab-coins": tabCoinsUrl,
  "tab-goals": tabGoalsUrl,
  debug: debugUrl,
  "auto-pause": autoPauseUrl,
  "auto-play": autoPlayUrl,
  trophy: trophyUrl,
  achievement: achievementUrl,
  "achievement-locked": achievementLockedUrl,
  coin: coinUrl,
  locked: lockedUrl,
  "shop-unlock": shopUnlockUrl,
  "shop-upgrade": shopUpgradeUrl,
  help: helpUrl,
  sound: soundUrl,
  "sound-mute": soundMuteUrl,
  spoon: spoonUrl,
};

const DISCOVERY_URLS: Record<DiscoveryIcon, string> = {
  bone: boneUrl,
  shard: shardUrl,
  crystal: crystalUrl,
  gear: gearUrl,
  stone: stoneUrl,
  tablet: tabletUrl,
  orb: orbUrl,
};

export function uiIconUrl(id: UiIconId): string {
  return UI_URLS[id];
}

export function discoveryIconUrl(id: DiscoveryIcon): string {
  return DISCOVERY_URLS[id];
}

function isUiIconId(v: string): v is UiIconId {
  return Object.prototype.hasOwnProperty.call(UI_URLS, v);
}

/** Fill every `<img data-icon="…">` under `root` from the UI icon map. */
export function applyDomIcons(root: ParentNode = document): void {
  const imgs = root.querySelectorAll<HTMLImageElement>("img[data-icon]");
  for (const img of imgs) {
    const id = img.dataset.icon;
    if (!id || !isUiIconId(id)) continue;
    img.src = UI_URLS[id];
    img.draggable = false;
    img.alt = img.alt || "";
  }
}

export function createUiIconImg(
  id: UiIconId,
  className = "psge-icon",
): HTMLImageElement {
  const img = document.createElement("img");
  img.className = className;
  img.dataset.icon = id;
  img.src = UI_URLS[id];
  img.alt = "";
  img.draggable = false;
  img.setAttribute("aria-hidden", "true");
  return img;
}

export function createDiscoveryIconImg(
  id: DiscoveryIcon,
  className = "discovery-icon",
): HTMLImageElement {
  const img = document.createElement("img");
  img.className = className;
  img.dataset.discoveryIcon = id;
  img.src = DISCOVERY_URLS[id];
  img.alt = "";
  img.draggable = false;
  img.setAttribute("aria-hidden", "true");
  return img;
}

/** Special-coin mark: generic coin art, optional tint via CSS filter/background. */
export function createCoinIconImg(
  unlocked: boolean,
  tintHex?: string,
  className = "coin-mark",
): HTMLImageElement {
  const img = createUiIconImg(unlocked ? "coin" : "locked", className);
  if (unlocked && tintHex) {
    img.style.background = tintHex;
  } else if (!unlocked) {
    img.style.background = "#3a4048";
  }
  return img;
}

export function createAchievementIconImg(
  unlocked: boolean,
  className = "achievement-mark",
): HTMLImageElement {
  return createUiIconImg(
    unlocked ? "achievement" : "achievement-locked",
    className,
  );
}
