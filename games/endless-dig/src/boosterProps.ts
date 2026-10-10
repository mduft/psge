/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Procedural dirt-coin meshes in the dig shaft (tap for 2×).
 */
import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  Raycaster,
  Vector2,
  type Camera,
  type Object3D,
} from "three";
import {
  visibleBoosters,
  type BoosterProgress,
  type BoosterValue,
  type DirtBooster,
} from "./boosters.js";

export interface BoosterProps {
  sync(
    excavatedDepth: number,
    worldSeed: number,
    progress: BoosterProgress,
  ): void;
  /** NDC pick (−1…1). Returns booster id or null. */
  pick(camera: Camera, ndcX: number, ndcY: number): string | null;
  update(dtSeconds: number): void;
  dispose(): void;
}

const VALUE_TINT: Record<BoosterValue, number> = {
  50: 0xb8a070,
  100: 0xd4b24a,
  200: 0xe8c84a,
  500: 0xffe08a,
};

function coinMaterial(value: BoosterValue): MeshLambertMaterial {
  return new MeshLambertMaterial({
    color: VALUE_TINT[value],
    emissive: VALUE_TINT[value],
    emissiveIntensity: value >= 200 ? 0.18 : 0.08,
  });
}

function buildCoin(b: DirtBooster): Mesh {
  const mesh = new Mesh(
    new CylinderGeometry(0.22, 0.22, 0.06, 14),
    coinMaterial(b.value),
  );
  mesh.name = `booster-${b.id}`;
  mesh.userData.boosterId = b.id;
  // Logical Y: 0 = surface, more negative = deeper (same as actors).
  const baseY = 1 - b.depth + 0.35;
  mesh.userData.baseY = baseY;
  mesh.rotation.x = Math.PI / 2;
  mesh.frustumCulled = false;
  mesh.position.set(b.x, baseY, b.z);
  return mesh;
}

function disposeObject(obj: Object3D): void {
  obj.traverse((child) => {
    if (child instanceof Mesh) {
      child.geometry?.dispose();
      const m = child.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    }
  });
}

export function createBoosterProps(parent: Object3D): BoosterProps {
  const root = new Group();
  root.name = "booster-props";
  parent.add(root);

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  let spin = 0;

  const clear = (): void => {
    while (root.children.length > 0) {
      const child = root.children[0]!;
      root.remove(child);
      disposeObject(child);
    }
  };

  return {
    sync(excavatedDepth, worldSeed, progress): void {
      clear();
      for (const b of visibleBoosters(progress, worldSeed, excavatedDepth)) {
        root.add(buildCoin(b));
      }
    },

    pick(camera, ndcX, ndcY): string | null {
      if (root.children.length === 0) return null;
      ndc.set(ndcX, ndcY);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(root.children, false);
      for (const hit of hits) {
        const id = hit.object.userData.boosterId;
        if (typeof id === "string") return id;
      }
      return null;
    },

    update(dtSeconds): void {
      if (root.children.length === 0) return;
      spin += dtSeconds * 1.6;
      for (const child of root.children) {
        child.rotation.z = spin;
        const base = child.userData.baseY;
        if (typeof base === "number") {
          child.position.y =
            base + Math.sin(spin * 2 + base * 0.7) * 0.05;
        }
      }
    },

    dispose(): void {
      clear();
      parent.remove(root);
    },
  };
}
