import {
  chunkIndex as engineChunkIndex,
  chunkRange,
  createChunkWindow,
  createFloatingOrigin,
} from "@psge/engine";
import {
  BoxGeometry,
  Color,
  Fog,
  Group,
  InstancedMesh,
  Matrix4,
  type Scene,
} from "three";
import { getBlockMaterial } from "./blockMaterials.js";
import { createSkyColor, type BlockId } from "./blockTextures.js";

export interface DigWorld {
  /** Logical focus in block units (0 = surface, negative = down). */
  getFocusBlockY(): number;
  setFocusBlockY(blockY: number): void;
  /**
   * Camera focus Y in render space (near 0 thanks to floating origin).
   * Equals `(focusBlockY - originBlockY) * BLOCK_SCALE`.
   */
  getRenderFocusY(): number;
  getOriginBlockY(): number;
  /** Vertical chunk index containing the logical focus. */
  getFocusChunkIndex(): number;
  getLoadedChunkCount(): number;
  dispose(): void;
}

export interface DigWorldOptions {
  /** Pre-carved shaft depth in blocks (M1.1 scroll test). */
  shaftDepth?: number;
}

/** Half-disk grass radius extending away from the player (−Z). */
const SURFACE_RADIUS = 32;
const Z_FRONT = 0;
const SHAFT_XS = [-1, 0] as const;
const SHAFT_ZS = [-1, 0] as const;
const DEEP_CUT_Z = -2;
/** Narrow wall strip for deep cutaway chunks. */
const WALL_HALF = 10;
export const BLOCK_SCALE = 1.55;

const CHUNK_SIZE = 16;
/** Keep this many chunks above and below the focus chunk. */
const CHUNK_RADIUS = 3;
/** Rebase floating origin when focus drifts this many blocks from origin. */
const REBASE_THRESHOLD = 48;

const sharedBox = new BoxGeometry(1, 1, 1);

const TREE_SPOTS: Array<[number, number]> = [
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

/**
 * Chunked cutaway world with floating-origin rebasing for deep shafts.
 * Streaming/origin math comes from `@psge/engine`; terrain content stays here.
 */
export function buildDigWorld(
  scene: Scene,
  options: DigWorldOptions = {},
): DigWorld {
  const shaftDepth = Math.max(0, Math.floor(options.shaftDepth ?? 1000));

  scene.background = createSkyColor();
  scene.fog = new Fog(new Color(0x87b7e0), 45, 100);

  const root = new Group();
  root.name = "dig-world-root";

  const content = new Group();
  content.name = "dig-world";
  content.scale.setScalar(BLOCK_SCALE);
  root.add(content);

  const chunkGroups = new Map<number, Group>();

  let focusBlockY = -1.2;

  const floating = createFloatingOrigin({
    rebaseThreshold: REBASE_THRESHOLD,
    scale: BLOCK_SCALE,
    onApply: (origin) => {
      root.position.y = -origin * BLOCK_SCALE;
    },
  });

  const inShaft = (x: number, z: number): boolean =>
    (SHAFT_XS as readonly number[]).includes(x) &&
    (SHAFT_ZS as readonly number[]).includes(z);

  const onSurfaceDisk = (x: number, z: number): boolean => {
    if (z > Z_FRONT) return false;
    return x * x + z * z <= SURFACE_RADIUS * SURFACE_RADIUS;
  };

  const chunks = createChunkWindow({
    chunkSize: CHUNK_SIZE,
    radius: CHUNK_RADIUS,
    load: (idx) => {
      const chunk = buildChunk(idx, shaftDepth, inShaft, onSurfaceDisk);
      chunkGroups.set(idx, chunk);
      content.add(chunk);
    },
    unload: (idx) => {
      const group = chunkGroups.get(idx);
      if (!group) return;
      disposeChunkGroup(group);
      content.remove(group);
      chunkGroups.delete(idx);
    },
    // Keep surface chunk while near the top so the half-disk does not pop.
    extraKeep: (focus) =>
      focus > -CHUNK_SIZE * (CHUNK_RADIUS + 1) ? [0] : [],
  });

  const setFocusBlockY = (blockY: number): void => {
    const minY = -(shaftDepth - 1.5);
    const maxY = 2.5;
    focusBlockY = Math.min(maxY, Math.max(minY, blockY));
    floating.rebaseIfNeeded(focusBlockY);
    chunks.sync(focusBlockY);
  };

  scene.add(root);
  floating.setOrigin(0);
  chunks.sync(focusBlockY);

  return {
    getFocusBlockY: () => focusBlockY,
    setFocusBlockY,
    getRenderFocusY: () => floating.toRender(focusBlockY),
    getOriginBlockY: () => floating.getOrigin(),
    getFocusChunkIndex: () => engineChunkIndex(Math.floor(focusBlockY), CHUNK_SIZE),
    getLoadedChunkCount: () => chunks.getLoadedCount(),
    dispose(): void {
      chunks.dispose();
      scene.remove(root);
      scene.fog = null;
    },
  };
}

function strata(y: number): BlockId {
  if (y >= -3) return "dirt";
  if (y >= -7) return "stone";
  if (y >= -11) return "granite";
  const band = Math.floor((-y - 12) / 8) % 4;
  return (["deepslate", "stone", "granite", "cobble"] as const)[band]!;
}

function buildChunk(
  index: number,
  shaftDepth: number,
  inShaft: (x: number, z: number) => boolean,
  onSurfaceDisk: (x: number, z: number) => boolean,
): Group {
  const { min: yMin, max: yMax } = chunkRange(index, CHUNK_SIZE);
  const buckets = new Map<BlockId, Matrix4[]>();
  const grassCaps: Matrix4[] = [];

  const add = (id: BlockId, x: number, y: number, z: number): void => {
    if (y < yMin || y > yMax) return;
    let list = buckets.get(id);
    if (!list) {
      list = [];
      buckets.set(id, list);
    }
    const m = new Matrix4();
    m.setPosition(x + 0.5, y + 0.5, z + 0.5);
    list.push(m);
  };

  const nearSurface = yMax >= -2 && yMin <= 8;

  // Half-disk landscape only for the shallow band (keeps chunk -1 from exploding).
  if (nearSurface && yMax >= -2) {
    const r = SURFACE_RADIUS;
    const localMin = Math.max(yMin, -2);
    const localMax = Math.min(yMax, 0);
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= Z_FRONT; z++) {
        if (!onSurfaceDisk(x, z)) continue;
        for (let y = localMax; y >= localMin; y--) {
          placeColumnBlock(add, grassCaps, inShaft, shaftDepth, x, y, z, true);
        }
      }
    }

    for (const [tx, tz] of TREE_SPOTS) {
      if (!onSurfaceDisk(tx, tz) || inShaft(tx, tz)) continue;
      if (Math.abs(tx) <= 3 && tz >= -4) continue;
      placeTree(add, tx, tz);
    }
  }

  // Cutaway wall strip for any underground rows in this chunk.
  const stripMax = Math.min(yMax, -3);
  const stripMin = Math.max(yMin, -shaftDepth - 1);
  if (stripMax >= stripMin) {
    for (let x = -WALL_HALF; x <= WALL_HALF; x++) {
      for (let z = DEEP_CUT_Z; z <= Z_FRONT; z++) {
        for (let y = stripMax; y >= stripMin; y--) {
          placeColumnBlock(add, grassCaps, inShaft, shaftDepth, x, y, z, false);
        }
      }
    }
  }

  const group = new Group();
  group.name = `chunk-${index}`;

  for (const [id, matrices] of buckets) {
    if (matrices.length === 0) continue;
    const mesh = new InstancedMesh(sharedBox, getBlockMaterial(id), matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  if (grassCaps.length > 0) {
    const mesh = new InstancedMesh(
      sharedBox,
      getBlockMaterial("grass"),
      grassCaps.length,
    );
    grassCaps.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.name = "grass-caps";
    group.add(mesh);
  }

  return group;
}

function placeColumnBlock(
  add: (id: BlockId, x: number, y: number, z: number) => void,
  grassCaps: Matrix4[],
  inShaft: (x: number, z: number) => boolean,
  shaftDepth: number,
  x: number,
  y: number,
  z: number,
  allowGrass: boolean,
): void {
  if (inShaft(x, z) && y <= 0 && y > -shaftDepth) {
    return;
  }
  if (inShaft(x, z) && y === -shaftDepth) {
    add("cobble", x, y, z);
    return;
  }
  if (inShaft(x, z) && y < -shaftDepth) {
    if (y >= -shaftDepth - 1) add("cobble", x, y, z);
    return;
  }
  if (y < -shaftDepth - 1) return;

  add(strata(y), x, y, z);

  if (allowGrass && y === 0 && !inShaft(x, z)) {
    const cap = new Matrix4();
    cap.makeScale(1, 0.14, 1);
    cap.setPosition(x + 0.5, 1.07, z + 0.5);
    grassCaps.push(cap);
  }
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

function disposeChunkGroup(group: Group): void {
  for (const child of [...group.children]) {
    if (child instanceof InstancedMesh) {
      // Shared geometry + cached materials — do not dispose those.
      child.count = 0;
      group.remove(child);
    }
  }
  group.clear();
}
