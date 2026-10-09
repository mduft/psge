import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Fog,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  type Scene,
} from "three";
import {
  createBlockMaterials,
  createSkyColor,
  type BlockId,
} from "./blockTextures.js";

export interface DigWorld {
  readonly group: Group;
  getShaftDepth(): number;
  getFocusY(): number;
}

export interface DigWorldOptions {
  initialShaftDepth?: number;
}

/** Half-disk grass radius extending away from the player (−Z). */
const SURFACE_RADIUS = 32;
/** Front cut faces +Z (player). */
const Z_FRONT = 0;
/**
 * 2×2 shaft footprint (block coords).
 * Open toward the player — no extra enclosed back-wall column.
 * Earth of the half-disk continues behind (z < SHAFT_Z0).
 */
const SHAFT_XS = [-1, 0] as const;
const SHAFT_ZS = [-1, 0] as const;
/** Full dig strata only near the front cut; farther back stays a shallow landscape. */
const DEEP_CUT_Z = -2;
const MAX_WORLD_DEPTH = 14;
/** Chunkier on-screen blocks. */
export const BLOCK_SCALE = 1.55;

/**
 * Block cutaway dig site with a half-circle surface behind the front cut.
 */
export function buildDigWorld(
  scene: Scene,
  options: DigWorldOptions = {},
): DigWorld {
  const shaftDepth = Math.max(4, Math.min(MAX_WORLD_DEPTH, options.initialShaftDepth ?? 12));

  scene.background = createSkyColor();
  scene.fog = new Fog(new Color(0x87b7e0), 45, 100);

  const group = new Group();
  group.name = "dig-world";
  group.scale.setScalar(BLOCK_SCALE);

  const buckets = new Map<BlockId, Matrix4[]>();
  const add = (id: BlockId, x: number, y: number, z: number): void => {
    let list = buckets.get(id);
    if (!list) {
      list = [];
      buckets.set(id, list);
    }
    const m = new Matrix4();
    m.setPosition(x + 0.5, y + 0.5, z + 0.5);
    list.push(m);
  };

  const inShaft = (x: number, z: number): boolean =>
    (SHAFT_XS as readonly number[]).includes(x) &&
    (SHAFT_ZS as readonly number[]).includes(z);

  const onSurfaceDisk = (x: number, z: number): boolean => {
    if (z > Z_FRONT) return false;
    return x * x + z * z <= SURFACE_RADIUS * SURFACE_RADIUS;
  };

  const strata = (y: number): BlockId => {
    if (y >= -3) return "dirt";
    if (y >= -7) return "stone";
    if (y >= -11) return "granite";
    return "deepslate";
  };

  const grassCaps: Matrix4[] = [];
  const r = SURFACE_RADIUS;

  for (let x = -r; x <= r; x++) {
    for (let z = -r; z <= Z_FRONT; z++) {
      if (!onSurfaceDisk(x, z)) continue;

      const deepSlice = z >= DEEP_CUT_Z;
      const minY = deepSlice ? -MAX_WORLD_DEPTH : -2;

      for (let y = 0; y >= minY; y--) {
        // 2×2 shaft cavity — cut open, no dedicated back-wall column.
        if (inShaft(x, z) && y <= 0 && y > -shaftDepth) {
          continue;
        }

        if (inShaft(x, z) && y === -shaftDepth) {
          add("cobble", x, y, z);
          continue;
        }

        if (inShaft(x, z) && y < -shaftDepth) {
          if (y >= -shaftDepth - 1) add("cobble", x, y, z);
          continue;
        }

        if (deepSlice && y < -shaftDepth - 1) continue;

        add(strata(y), x, y, z);

        if (y === 0 && !inShaft(x, z)) {
          const cap = new Matrix4();
          cap.makeScale(1, 0.14, 1);
          cap.setPosition(x + 0.5, 1.07, z + 0.5);
          grassCaps.push(cap);
        }
      }
    }
  }

  // Trees — especially toward the rim so the half-disk edge softens.
  const treeSpots: Array<[number, number]> = [
    [-7, -2],
    [-11, -4],
    [-15, -7],
    [-18, -12],
    [-20, -18],
    [-16, -22],
    [-10, -26],
    [-4, -28],
    [2, -29],
    [8, -26],
    [13, -22],
    [17, -16],
    [20, -10],
    [18, -5],
    [12, -3],
    [-14, -14],
    [6, -18],
    [-8, -20],
    [15, -24],
    [-19, -8],
    [9, -12],
    [-2, -16],
    [4, -8],
    [-22, -14],
    [22, -14],
  ];

  for (const [tx, tz] of treeSpots) {
    if (!onSurfaceDisk(tx, tz) || inShaft(tx, tz)) continue;
    // Keep a clear apron around the shaft mouth.
    if (Math.abs(tx) <= 3 && tz >= -4) continue;
    placeTree(add, tx, tz);
  }

  placeHouse(add, 7, -6);

  const geo = new BoxGeometry(1, 1, 1);
  for (const [id, matrices] of buckets) {
    const mats = createBlockMaterials(id);
    const material = (
      id === "leaves" ? mats[2] : mats[0]
    ) as MeshLambertMaterial;

    const mesh = new InstancedMesh(geo, material, matrices.length);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = `blocks-${id}`;
    group.add(mesh);

    for (const m of mats) {
      if (m !== material) {
        (m as MeshLambertMaterial).map?.dispose();
        m.dispose();
      }
    }
  }

  if (grassCaps.length > 0) {
    const grassMats = createBlockMaterials("grass");
    const grassMat = grassMats[2] as MeshLambertMaterial;
    const caps = new InstancedMesh(geo, grassMat, grassCaps.length);
    grassCaps.forEach((m, i) => caps.setMatrixAt(i, m));
    caps.instanceMatrix.needsUpdate = true;
    caps.name = "grass-caps";
    group.add(caps);
    for (const m of grassMats) {
      if (m !== grassMat) {
        (m as MeshLambertMaterial).map?.dispose();
        m.dispose();
      }
    }
  }

  scene.add(group);

  // Focus near the shaft mouth so grass + cutaway both read.
  const focusY = -1.2 * BLOCK_SCALE;

  return {
    group,
    getShaftDepth: () => shaftDepth,
    getFocusY: () => focusY,
  };
}

function placeTree(
  add: (id: BlockId, x: number, y: number, z: number) => void,
  x: number,
  z: number,
): void {
  const height = 3 + Math.abs((x * 5 + z * 3) % 3);
  for (let i = 1; i <= height; i++) add("log", x, i, z);
  const top = height;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = top; dy <= top + 2; dy++) {
        if (Math.abs(dx) + Math.abs(dz) > 3) continue;
        if (dy === top + 2 && Math.abs(dx) + Math.abs(dz) > 1) continue;
        if (dx === 0 && dz === 0 && dy <= top) continue;
        add("leaves", x + dx, dy, z + dz);
      }
    }
  }
}

function placeHouse(
  add: (id: BlockId, x: number, y: number, z: number) => void,
  x: number,
  z: number,
): void {
  for (let dx = 0; dx < 5; dx++) {
    for (let dz = 0; dz < 4; dz++) {
      for (let dy = 1; dy <= 3; dy++) {
        const wall = dx === 0 || dx === 4 || dz === 0 || dz === 3 || dy === 3;
        const door = dx === 2 && dz === 3 && dy <= 2;
        if (!wall || door) continue;
        add(dy === 3 ? "planks" : "cobble", x + dx, dy, z + dz);
      }
    }
  }
  for (let dx = 0; dx < 5; dx++) {
    add("planks", x + dx, 4, z + 1);
    add("planks", x + dx, 4, z + 2);
  }
}
