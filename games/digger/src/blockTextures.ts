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
import {
  geoPaletteTint,
  geoSkyColor,
  tintHex,
  type GeoLayerId,
} from "./geoLayers.js";

export type BlockId =
  | "grass"
  | "dirt"
  | "stone"
  | "granite"
  | "deepslate"
  | "log"
  | "leaves"
  | "cobble"
  | "lava"
  | "gem"
  | "iron";

export type PaletteFamily = GeoLayerId;

interface BlockPalette {
  top: string;
  side: string;
  bottom: string;
  noise: number;
}

const BASE_PALETTES: Record<BlockId, BlockPalette> = {
  grass: { top: "#5d9b3a", side: "#8b5a2b", bottom: "#6b4424", noise: 28 },
  dirt: { top: "#8b5a2b", side: "#7a4e24", bottom: "#6b4424", noise: 22 },
  stone: { top: "#8a8a8a", side: "#7a7a7a", bottom: "#6a6a6a", noise: 30 },
  granite: { top: "#9a6b5a", side: "#8a5b4a", bottom: "#7a4b3a", noise: 26 },
  deepslate: { top: "#3d4450", side: "#323842", bottom: "#282e36", noise: 20 },
  log: { top: "#6b4f2a", side: "#5a3f22", bottom: "#4a3218", noise: 18 },
  leaves: { top: "#3f8f3a", side: "#347a30", bottom: "#2a6628", noise: 35 },
  cobble: { top: "#7d7d7d", side: "#6e6e6e", bottom: "#5f5f5f", noise: 40 },
  lava: { top: "#ff6622", side: "#ee4400", bottom: "#cc2200", noise: 8 },
  gem: { top: "#2affc8", side: "#1ad4a8", bottom: "#0fb890", noise: 10 },
  // Fallback palette; wall accents paint ore flecks over underlying rock.
  iron: { top: "#d8c4a8", side: "#c4b090", bottom: "#a89878", noise: 12 },
};

/** Distinct procedural patterns for lava / gem / iron wall accents. */
export const ACCENT_VARIANTS = 4;

function isAccentBlock(id: BlockId): boolean {
  return id === "lava" || id === "gem" || id === "iron";
}

function tintForFamily(family: PaletteFamily): {
  h: number;
  s: number;
  l: number;
} {
  return geoPaletteTint(family);
}

function skyForFamily(family: PaletteFamily): number {
  return geoSkyColor(family);
}

function paletteFor(id: BlockId, family: PaletteFamily): BlockPalette {
  const base = BASE_PALETTES[id];
  const tint = tintForFamily(family);
  return {
    top: tintHex(base.top, tint),
    side: tintHex(base.side, tint),
    bottom: tintHex(base.bottom, tint),
    noise: base.noise,
  };
}

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

const LAVA_PALETTE = [
  "#3a0800",
  "#7a1400",
  "#cc2200",
  "#ff4400",
  "#ff6a10",
  "#ff9a28",
  "#ffcc55",
] as const;

function lavaColor(i: number): string {
  return LAVA_PALETTE[((i % LAVA_PALETTE.length) + LAVA_PALETTE.length) % LAVA_PALETTE.length]!;
}

/**
 * Procedural lava — one shared recipe (mottled crust + hot pockets).
 * Seed only shifts blotch placement / heat so variants stay in the same family.
 */
function paintLavaFace(
  ctx: CanvasRenderingContext2D,
  size: number,
  seed: number,
): void {
  ctx.fillStyle = lavaColor(1);
  ctx.fillRect(0, 0, size, size);

  // Mid-tone crust noise (same density for every variant).
  for (let i = 0; i < 36; i++) {
    const x = (hash01(i, 1, seed) * size) | 0;
    const y = (hash01(i, 2, seed) * size) | 0;
    ctx.fillStyle = lavaColor(2 + ((hash01(i, 3, seed) * 2) | 0)); // 2…3
    ctx.fillRect(x, y, 1 + ((hash01(i, 4, seed) * 2) | 0), 1);
  }

  // Darker cooler patches
  for (let i = 0; i < 8; i++) {
    const x = (hash01(i, 5, seed) * size) | 0;
    const y = (hash01(i, 6, seed) * size) | 0;
    const r = 1 + ((hash01(i, 7, seed) * 2) | 0);
    ctx.fillStyle = lavaColor(0 + ((hash01(i, 8, seed) * 2) | 0)); // 0…1
    ctx.fillRect(x, y, r + 1, r);
  }

  // Hotter magma pockets (count + spot vary; shape stays soft squares)
  const pockets = 3 + ((hash01(0, 9, seed) * 3) | 0); // 3…5
  for (let i = 0; i < pockets; i++) {
    const x = 1 + ((hash01(i, 10, seed) * (size - 4)) | 0);
    const y = 1 + ((hash01(i, 11, seed) * (size - 4)) | 0);
    const w = 2 + ((hash01(i, 12, seed) * 2) | 0);
    const h = 2 + ((hash01(i, 13, seed) * 2) | 0);
    ctx.fillStyle = lavaColor(4 + ((hash01(i, 14, seed) * 2) | 0)); // 4…5
    ctx.fillRect(x, y, w, h);
    // Bright core
    ctx.fillStyle = lavaColor(5 + ((hash01(i, 15, seed) * 2) | 0)); // 5…6
    ctx.fillRect(x + ((w / 2) | 0), y + ((h / 2) | 0), 1, 1);
  }

  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
}

const GEM_COLORS = [
  "#1ad4a8",
  "#2affc8",
  "#40ffe0",
  "#80ffee",
  "#00cc99",
  "#a8ffe8",
] as const;

/** Iron ore flecks — warm tan / raw-iron on dark rock. */
const IRON_ORE_COLORS = [
  "#e8d4b8",
  "#d8c4a0",
  "#c8b088",
  "#f0e0c8",
  "#bca078",
  "#a89068",
  "#d0b890",
] as const;

function paintOreShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  shape: number,
  color: string,
): void {
  ctx.fillStyle = color;
  const s = shape % 5;
  if (s === 0) {
    // Tiny square
    ctx.fillRect(x, y, 2, 2);
  } else if (s === 1) {
    // Diamond (plus)
    ctx.fillRect(x + 1, y, 1, 3);
    ctx.fillRect(x, y + 1, 3, 1);
  } else if (s === 2) {
    // L-piece
    ctx.fillRect(x, y, 1, 3);
    ctx.fillRect(x, y + 2, 2, 1);
  } else if (s === 3) {
    // Horizontal bar
    ctx.fillRect(x, y, 3, 1);
    ctx.fillRect(x + 1, y + 1, 1, 1);
  } else {
    // Single bright fleck + neighbor
    ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(x + 1, y, 1, 1);
    ctx.fillRect(x, y + 1, 1, 1);
  }
}

/**
 * Underlying rock face with scattered smaller gemstones (not full-block gems).
 */
function paintGemFace(
  ctx: CanvasRenderingContext2D,
  under: BlockPalette,
  size: number,
  seed: number,
): void {
  paintFace(ctx, under.side, under.noise, size, seed + 40);
  const count = 2 + ((hash01(0, 30, seed) * 4) | 0); // 2…5
  for (let i = 0; i < count; i++) {
    const gw = 2 + ((hash01(i, 31, seed) * 2) | 0);
    const gh = 2 + ((hash01(i, 32, seed) * 2) | 0);
    const x = 1 + ((hash01(i, 33, seed) * Math.max(1, size - gw - 1)) | 0);
    const y = 1 + ((hash01(i, 34, seed) * Math.max(1, size - gh - 1)) | 0);
    const color =
      GEM_COLORS[(hash01(i, 35, seed) * GEM_COLORS.length) | 0]!;
    const shape = (hash01(i, 36, seed) * 5) | 0;
    paintOreShape(ctx, x, y, shape, color);
    // Hot core highlight
    if (hash01(i, 37, seed) > 0.35) {
      ctx.fillStyle = "#e8fff8";
      ctx.fillRect(x + ((gw / 2) | 0), y + ((gh / 2) | 0), 1, 1);
    }
  }
}

/**
 * Deep-crust iron ore — rock with tan ore blotches.
 */
function paintIronFace(
  ctx: CanvasRenderingContext2D,
  under: BlockPalette,
  size: number,
  seed: number,
): void {
  paintFace(ctx, under.side, under.noise, size, seed + 40);
  const count = 3 + ((hash01(0, 40, seed) * 4) | 0); // 3…6
  for (let i = 0; i < count; i++) {
    const gw = 2 + ((hash01(i, 41, seed) * 3) | 0); // 2…4
    const gh = 2 + ((hash01(i, 42, seed) * 3) | 0);
    const x = 1 + ((hash01(i, 43, seed) * Math.max(1, size - gw - 1)) | 0);
    const y = 1 + ((hash01(i, 44, seed) * Math.max(1, size - gh - 1)) | 0);
    const color =
      IRON_ORE_COLORS[(hash01(i, 45, seed) * IRON_ORE_COLORS.length) | 0]!;
    const shape = (hash01(i, 46, seed) * 5) | 0;
    paintOreShape(ctx, x, y, shape, color);
    // Soft metallic highlight (less neon than gems).
    if (hash01(i, 47, seed) > 0.4) {
      ctx.fillStyle = "#fff6e8";
      ctx.fillRect(x + ((gw / 2) | 0), y + ((gh / 2) | 0), 1, 1);
    }
  }
}

function makeLavaTexture(variant: number): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_SIZE;
  canvas.height = FACE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  paintLavaFace(ctx, FACE_SIZE, 0x1a7a00 + variant * 97);
  return canvasToTexture(canvas);
}

function makeGemTexture(
  underId: BlockId,
  family: PaletteFamily,
  variant: number,
): CanvasTexture {
  const under = paletteFor(isAccentBlock(underId) ? "deepslate" : underId, family);
  const canvas = document.createElement("canvas");
  canvas.width = FACE_SIZE;
  canvas.height = FACE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  paintGemFace(ctx, under, FACE_SIZE, 0x6e1100 + variant * 131);
  return canvasToTexture(canvas);
}

function makeIronTexture(
  underId: BlockId,
  family: PaletteFamily,
  variant: number,
): CanvasTexture {
  const under = paletteFor(isAccentBlock(underId) ? "deepslate" : underId, family);
  const canvas = document.createElement("canvas");
  canvas.width = FACE_SIZE;
  canvas.height = FACE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  paintIronFace(ctx, under, FACE_SIZE, 0x12e000 + variant * 149);
  return canvasToTexture(canvas);
}

function makeGlowMaterial(
  map: CanvasTexture,
  emissive: number,
  intensity: number,
): MeshLambertMaterial {
  return new MeshLambertMaterial({
    map,
    color: 0xffffff,
    emissive,
    emissiveMap: map,
    emissiveIntensity: intensity,
  });
}

/** Wear 0…31 dig-face top texture (border fixed, interior densifies). */
export function makeDigWearTopTexture(
  id: BlockId,
  wear: number,
  family: PaletteFamily = "soil",
): CanvasTexture {
  const p = paletteFor(id, family);
  const w = Math.max(0, Math.min(31, wear | 0));
  const canvas = document.createElement("canvas");
  canvas.width = FACE_SIZE;
  canvas.height = FACE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas unavailable");
  }
  const seed =
    id.split("").reduce((a, ch) => a + ch.charCodeAt(0), 17) +
    family.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  paintDigWearTop(ctx, p.top, p.noise, w, FACE_SIZE, seed);
  return canvasToTexture(canvas);
}

export interface AccentMaterialOpts {
  /** 0…ACCENT_VARIANTS-1 pattern index. */
  variant?: number;
  /** Rock under gem / iron flecks (ignored for lava). */
  under?: BlockId;
}

/** Block face materials: [right, left, top, bottom, front, back] */
export function createBlockMaterials(
  id: BlockId,
  family: PaletteFamily = "soil",
  opts: AccentMaterialOpts = {},
): Material[] {
  const variant = Math.max(
    0,
    Math.min(ACCENT_VARIANTS - 1, (opts.variant ?? 0) | 0),
  );

  if (id === "lava") {
    const map = makeLavaTexture(variant);
    const mat = makeGlowMaterial(map, 0xff5500, 2.4);
    return [mat, mat, mat, mat, mat, mat];
  }
  if (id === "gem") {
    const under = opts.under ?? "deepslate";
    const map = makeGemTexture(under, family, variant);
    const mat = makeGlowMaterial(map, 0x40ffd0, 2.1);
    return [mat, mat, mat, mat, mat, mat];
  }
  if (id === "iron") {
    const under = opts.under ?? "deepslate";
    const map = makeIronTexture(under, family, variant);
    // Soft metallic sheen — less neon than gems / lava.
    const mat = makeGlowMaterial(map, 0xc8b090, 1.15);
    return [mat, mat, mat, mat, mat, mat];
  }

  const p = paletteFor(id, family);
  const top = makeFaceTexture(p.top, p.noise, 1);
  const side = makeFaceTexture(p.side, p.noise, 2);
  const bottom = makeFaceTexture(p.bottom, Math.max(8, p.noise - 6), 3);

  const mk = (map: CanvasTexture) => new MeshLambertMaterial({ map });

  return [mk(side), mk(side), mk(top), mk(bottom), mk(side), mk(side)];
}

export function createSkyColor(family: PaletteFamily = "soil"): Color {
  return new Color(skyForFamily(family));
}
