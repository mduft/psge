/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { MeshLambertMaterial, type Material, type Texture } from "three";
import {
  ACCENT_VARIANTS,
  createBlockMaterials,
  makeDigWearTopTexture,
  type AccentMaterialOpts,
  type BlockId,
  type PaletteFamily,
} from "./blockTextures.js";

/** Shared materials so chunk load/unload does not leak GPU resources. */
const cache = new Map<string, Material>();

/** Base 6-face materials per block (sides/bottom stable; top swapped for dig wear). */
const digFaceBase = new Map<string, Material[]>();
const digFaceWearTops = new Map<string, MeshLambertMaterial>();

function cacheKey(
  id: BlockId,
  family: PaletteFamily,
  opts: AccentMaterialOpts = {},
): string {
  if (id === "lava") {
    const v = (opts.variant ?? 0) % ACCENT_VARIANTS;
    return `${family}:lava:${v}`;
  }
  if (id === "gem" || id === "iron") {
    const v = (opts.variant ?? 0) % ACCENT_VARIANTS;
    return `${family}:${id}:${opts.under ?? "deepslate"}:${v}`;
  }
  return `${family}:${id}`;
}

function isGlowAccent(id: BlockId): boolean {
  return id === "lava" || id === "gem" || id === "iron";
}

export function getBlockMaterial(
  id: BlockId,
  family: PaletteFamily = "soil",
  opts: AccentMaterialOpts = {},
): Material {
  const key = cacheKey(id, family, opts);
  let mat = cache.get(key);
  if (!mat) {
    const faces = createBlockMaterials(id, family, opts);
    mat = id === "leaves" || id === "grass" ? faces[2]! : faces[0]!;
    if (!isGlowAccent(id)) {
      const keepMap = (mat as MeshLambertMaterial).map ?? null;
      const disposedMaps = new Set<Texture>();
      for (const face of faces) {
        if (face === mat) continue;
        const m = face as MeshLambertMaterial;
        if (m.map && m.map !== keepMap && !disposedMaps.has(m.map)) {
          disposedMaps.add(m.map);
          m.map.dispose();
        }
        m.dispose();
      }
    }
    cache.set(key, mat);
  }
  return mat;
}

/**
 * Multi-material dig-face set: sides/bottom from a stable base, top from a
 * coarse wear texture (8 levels). Border stays fixed; levels stay stable
 * during auto-dig so the floor does not thrash every 1/32 step.
 */
export function getDigFaceMaterials(
  id: BlockId,
  remainHeight: number,
  family: PaletteFamily = "soil",
  opts: AccentMaterialOpts = {},
): Material[] {
  if (isGlowAccent(id)) {
    const glow = getBlockMaterial(id, family, opts);
    return [glow, glow, glow, glow, glow, glow];
  }
  const baseKey = cacheKey(id, family);
  let base = digFaceBase.get(baseKey);
  if (!base) {
    base = createBlockMaterials(id, family);
    digFaceBase.set(baseKey, base);
  }
  const step = Math.max(0, Math.min(32, Math.round(remainHeight * 32)));
  const wear = Math.min(7, Math.floor((32 - step) / 4)); // 0…7
  const key = `${family}:${id}:${wear}`;
  let top = digFaceWearTops.get(key);
  if (!top) {
    top = new MeshLambertMaterial({
      map: makeDigWearTopTexture(id, wear * 4, family),
    });
    digFaceWearTops.set(key, top);
  }
  return [base[0]!, base[1]!, top, base[3]!, base[4]!, base[5]!];
}
