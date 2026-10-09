/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import type { UpgradeLevels } from "./upgrades.js";
import jackhammerUrl from "../assets/textures/cursors/jackhammer.png";
import pickaxeUrl from "../assets/textures/cursors/pickaxe.png";
import shovelUrl from "../assets/textures/cursors/shovel.png";
import spoonUrl from "../assets/textures/cursors/spoon.png";

export type DigTool = "spoon" | "shovel" | "pickaxe" | "jackhammer";

/** Highest dig tool owned (passive upgrades do not change the cursor). */
export function digToolOf(upgrades: UpgradeLevels): DigTool {
  if (upgrades.jackhammer > 0) return "jackhammer";
  if (upgrades.pickaxe > 0) return "pickaxe";
  if (upgrades.shovel > 0) return "shovel";
  return "spoon";
}

/** Hotspot [x, y] on 32×32 art — tip / dig end. */
const HOTSPOTS: Record<DigTool, readonly [number, number]> = {
  spoon: [15, 24],
  shovel: [15, 28],
  pickaxe: [10, 2],
  jackhammer: [15, 29],
};

const URLS: Record<DigTool, string> = {
  spoon: spoonUrl,
  shovel: shovelUrl,
  pickaxe: pickaxeUrl,
  jackhammer: jackhammerUrl,
};

function cursorCss(tool: DigTool): string {
  const [hx, hy] = HOTSPOTS[tool];
  return `url("${URLS[tool]}") ${hx} ${hy}, crosshair`;
}

/** Apply the dig-tool cursor to the game canvas. */
export function applyDigCursor(canvas: HTMLElement, tool: DigTool): void {
  canvas.style.cursor = cursorCss(tool);
  canvas.dataset.digTool = tool;
}
