/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Basic procedural shaft props for discoveries (M7). Swap meshes later.
 */
import {
  BoxGeometry,
  CylinderGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  type Object3D,
} from "three";
import {
  DISCOVERY_DEFS,
  discoveryPropCell,
  getDiscoveryDef,
  type DiscoveryDef,
  type DiscoveryProgress,
} from "./discoveries.js";
import { isDigShaftCell } from "./digShaft.js";

export interface DiscoveryProps {
  sync(excavatedDepth: number, progress: DiscoveryProgress): void;
  dispose(): void;
}

const TEASE_RANGE_M = 8;

function mat(hex: number, opacity = 1): MeshLambertMaterial {
  return new MeshLambertMaterial({
    color: hex,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });
}

function addMesh(
  parent: Object3D,
  geometry: BoxGeometry | CylinderGeometry | ConeGeometry,
  material: MeshLambertMaterial,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.frustumCulled = false;
  parent.add(mesh);
  return mesh;
}

function buildPropMesh(def: DiscoveryDef, dim: boolean): Group {
  const g = new Group();
  g.name = `discovery-${def.id}`;
  const opacity = dim ? 0.35 : 1;
  const c = mat(def.propTint, opacity);
  switch (def.icon) {
    case "bone":
      addMesh(g, new BoxGeometry(0.12, 0.55, 0.12), c, 0, 0.2, 0);
      addMesh(g, new BoxGeometry(0.22, 0.1, 0.12), c, 0, 0.48, 0);
      addMesh(g, new BoxGeometry(0.22, 0.1, 0.12), c, 0, -0.05, 0);
      break;
    case "shard":
      addMesh(g, new BoxGeometry(0.28, 0.35, 0.08), c, 0, 0.18, 0);
      break;
    case "crystal":
      addMesh(g, new ConeGeometry(0.16, 0.5, 5), c, 0, 0.25, 0);
      break;
    case "gear":
      addMesh(g, new BoxGeometry(0.35, 0.12, 0.12), c, 0, 0.2, 0);
      addMesh(g, new BoxGeometry(0.12, 0.12, 0.35), c, 0, 0.2, 0);
      break;
    case "stone":
      addMesh(g, new BoxGeometry(0.3, 0.22, 0.24), c, 0, 0.12, 0);
      break;
    case "tablet":
      addMesh(g, new BoxGeometry(0.36, 0.42, 0.06), c, 0, 0.22, 0);
      break;
    case "orb":
      addMesh(g, new CylinderGeometry(0.18, 0.18, 0.28, 10), c, 0, 0.18, 0);
      break;
    default:
      addMesh(g, new BoxGeometry(0.25, 0.25, 0.25), c, 0, 0.15, 0);
  }
  return g;
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

export function createDiscoveryProps(parent: Object3D): DiscoveryProps {
  const root = new Group();
  root.name = "discovery-props";
  parent.add(root);

  const clear = (): void => {
    while (root.children.length > 0) {
      const child = root.children[0]!;
      root.remove(child);
      disposeObject(child);
    }
  };

  return {
    sync(excavatedDepth: number, progress: DiscoveryProgress): void {
      clear();
      const owned = new Set(progress.unlocked);
      const faceY = 1 - Math.max(0, excavatedDepth);

      for (const def of DISCOVERY_DEFS) {
        const unlocked = owned.has(def.id);
        const tease =
          !unlocked &&
          def.kind === "milestone" &&
          excavatedDepth >= def.minDepth - TEASE_RANGE_M &&
          excavatedDepth < def.minDepth;
        if (!unlocked && !tease) continue;

        const cell = discoveryPropCell(def.id, progress.worldSeed);
        if (isDigShaftCell(cell.x, cell.z)) continue;

        // Keep props near the dig face vertically so they stay in the chunk window.
        const y = unlocked
          ? Math.min(cell.y, faceY - 0.5)
          : -def.minDepth + 0.5;
        const mesh = buildPropMesh(def, tease);
        mesh.position.set(cell.x + 0.5, y, cell.z + 0.5);
        root.add(mesh);
      }
    },

    dispose(): void {
      clear();
      parent.remove(root);
    },
  };
}

export function discoveryName(id: string): string {
  return getDiscoveryDef(id)?.name ?? id;
}
