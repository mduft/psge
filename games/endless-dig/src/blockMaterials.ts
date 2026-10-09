/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { MeshLambertMaterial, type Material, type Texture } from "three";
import { createBlockMaterials, type BlockId } from "./blockTextures.js";

/** Shared materials so chunk load/unload does not leak GPU resources. */
const cache = new Map<BlockId, Material>();

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
