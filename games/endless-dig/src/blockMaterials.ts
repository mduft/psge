import { MeshLambertMaterial, type Material } from "three";
import { createBlockMaterials, type BlockId } from "./blockTextures.js";

/** Shared materials so chunk load/unload does not leak GPU resources. */
const cache = new Map<BlockId, Material>();

export function getBlockMaterial(id: BlockId): Material {
  let mat = cache.get(id);
  if (!mat) {
    const faces = createBlockMaterials(id);
    mat = id === "leaves" || id === "grass" ? faces[2]! : faces[0]!;
    for (const face of faces) {
      if (face !== mat) {
        const m = face as MeshLambertMaterial;
        m.map?.dispose();
        m.dispose();
      }
    }
    cache.set(id, mat);
  }
  return mat;
}
