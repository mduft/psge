/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { MeshLambertMaterial, type Material, type Texture } from "three";
import {
  createBlockMaterials,
  makeDigWearTopTexture,
  type BlockId,
} from "./blockTextures.js";

/** Shared materials so chunk load/unload does not leak GPU resources. */
const cache = new Map<BlockId, Material>();

/** Base 6-face materials per block (sides/bottom stable; top swapped for dig wear). */
const digFaceBase = new Map<BlockId, Material[]>();
const digFaceWearTops = new Map<string, MeshLambertMaterial>();

export function getBlockMaterial(id: BlockId): Material {
  let mat = cache.get(id);
  if (!mat) {
    const faces = createBlockMaterials(id);
    mat = id === "leaves" || id === "grass" ? faces[2]! : faces[0]!;
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
    cache.set(id, mat);
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
): Material[] {
  let base = digFaceBase.get(id);
  if (!base) {
    base = createBlockMaterials(id);
    digFaceBase.set(id, base);
  }
  const step = Math.max(0, Math.min(32, Math.round(remainHeight * 32)));
  const wear = Math.min(7, Math.floor((32 - step) / 4)); // 0…7
  const key = `${id}:${wear}`;
  let top = digFaceWearTops.get(key);
  if (!top) {
    // Map coarse level → paint intensity 0…31 for the wear artist.
    top = new MeshLambertMaterial({
      map: makeDigWearTopTexture(id, wear * 4),
    });
    digFaceWearTops.set(key, top);
  }
  return [base[0]!, base[1]!, top, base[3]!, base[4]!, base[5]!];
}
