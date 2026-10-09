/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import {
  CanvasTexture,
  Color,
  MeshLambertMaterial,
  NearestFilter,
  SRGBColorSpace,
  type Material,
} from "three";

export type BlockId =
  | "grass"
  | "dirt"
  | "stone"
  | "granite"
  | "deepslate"
  | "log"
  | "leaves"
  | "cobble";

interface BlockPalette {
  top: string;
  side: string;
  bottom: string;
  noise: number;
}

const PALETTES: Record<BlockId, BlockPalette> = {
  grass: { top: "#5d9b3a", side: "#8b5a2b", bottom: "#6b4424", noise: 28 },
  dirt: { top: "#8b5a2b", side: "#7a4e24", bottom: "#6b4424", noise: 22 },
  stone: { top: "#8a8a8a", side: "#7a7a7a", bottom: "#6a6a6a", noise: 30 },
  granite: { top: "#9a6b5a", side: "#8a5b4a", bottom: "#7a4b3a", noise: 26 },
  deepslate: { top: "#3d4450", side: "#323842", bottom: "#282e36", noise: 20 },
  log: { top: "#6b4f2a", side: "#5a3f22", bottom: "#4a3218", noise: 18 },
  leaves: { top: "#3f8f3a", side: "#347a30", bottom: "#2a6628", noise: 35 },
  cobble: { top: "#7d7d7d", side: "#6e6e6e", bottom: "#5f5f5f", noise: 40 },
};

const FACE_SIZE = 16;

/** Deterministic 0..1 hash (no Math.random — dig-wear must not shimmer). */
function hash01(x: number, y: number, seed: number): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function paintFace(
  ctx: CanvasRenderingContext2D,
  hex: string,
  noise: number,
  size: number,
  seed = 1,
): void {
  const base = new Color(hex);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < noise; i++) {
    const x = (hash01(i, 1, seed) * size) | 0;
    const y = (hash01(i, 2, seed) * size) | 0;
    const c = base.clone();
    const d = (hash01(i, 3, seed) - 0.5) * 0.22;
    c.offsetHSL(0, 0, d);
    ctx.fillStyle = `#${c.getHexString()}`;
    const w = 1 + ((hash01(i, 4, seed) * 2) | 0);
    ctx.fillRect(x, y, w, 1);
  }

  // Subtle edge darkening (reads as block bevel without AO pass).
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
}

/**
 * Dig-face top: same fixed border as a normal face, with extra interior wear
 * keyed by dig step (0 = pristine … 31 = heavily chewed).
 */
function paintDigWearTop(
  ctx: CanvasRenderingContext2D,
  hex: string,
  baseNoise: number,
  wear: number,
  size: number,
  seed: number,
): void {
  const base = new Color(hex);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);

  const inner = size - 2;
  const noiseCount = baseNoise + Math.floor(wear * 1.25);
  for (let i = 0; i < noiseCount; i++) {
    const x = 1 + ((hash01(i, 11, seed) * inner) | 0);
    const y = 1 + ((hash01(i, 12, seed) * inner) | 0);
    const c = base.clone();
    // Milder than a normal face — wear should read as scuff, not soot.
    const d = (hash01(i, 13, seed) - 0.52) * 0.18;
    c.offsetHSL(0, 0, d);
    ctx.fillStyle = `#${c.getHexString()}`;
    ctx.fillRect(x, y, 1, 1);
  }

  // A few darker chips that accumulate with wear (still inside the border).
  const chips = Math.floor(wear / 4);
  for (let i = 0; i < chips; i++) {
    const x = 2 + ((hash01(i, 21, seed + wear) * (size - 4)) | 0);
    const y = 2 + ((hash01(i, 22, seed + wear) * (size - 4)) | 0);
    const c = base.clone();
    c.offsetHSL(0, -0.03, -0.08 - hash01(i, 23, seed) * 0.06);
    ctx.fillStyle = `#${c.getHexString()}`;
    ctx.fillRect(x, y, 1 + ((hash01(i, 24, seed) * 2) | 0), 1);
  }

  // Border last — never moves with wear.
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
}

function canvasToTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeFaceTexture(hex: string, noise: number, seed = 1): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_SIZE;
  canvas.height = FACE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas unavailable");
  }
  paintFace(ctx, hex, noise, FACE_SIZE, seed);
  return canvasToTexture(canvas);
}

/** Wear 0…31 dig-face top texture (border fixed, interior densifies). */
export function makeDigWearTopTexture(id: BlockId, wear: number): CanvasTexture {
  const p = PALETTES[id];
  const w = Math.max(0, Math.min(31, wear | 0));
  const canvas = document.createElement("canvas");
  canvas.width = FACE_SIZE;
  canvas.height = FACE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas unavailable");
  }
  const seed = id.split("").reduce((a, ch) => a + ch.charCodeAt(0), 17);
  paintDigWearTop(ctx, p.top, p.noise, w, FACE_SIZE, seed);
  return canvasToTexture(canvas);
}

/** Minecraft-style materials: [right, left, top, bottom, front, back] */
export function createBlockMaterials(id: BlockId): Material[] {
  const p = PALETTES[id];
  const top = makeFaceTexture(p.top, p.noise, 1);
  const side = makeFaceTexture(p.side, p.noise, 2);
  const bottom = makeFaceTexture(p.bottom, Math.max(8, p.noise - 6), 3);

  const mk = (map: CanvasTexture) => new MeshLambertMaterial({ map });

  return [mk(side), mk(side), mk(top), mk(bottom), mk(side), mk(side)];
}

export function createSkyColor(): Color {
  return new Color(0x87b7e0);
}
