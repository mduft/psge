/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
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
  type BufferAttribute,
  type Scene,
} from "three";
import { getBlockMaterial } from "./blockMaterials.js";
import { createSkyColor, type BlockId } from "./blockTextures.js";
import { createDigParticles } from "./digParticles.js";

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
  /** How far the open shaft cavity goes (positive blocks down). */
  getExcavatedDepth(): number;
  setExcavatedDepth(depth: number): void;
  /** Solid-earth generation extent (positive blocks down); grows with dig. */
  getWorldExtent(): number;
  /**
   * Ensure solid generation reaches at least `minExtent` (ceil).
   * Returns true when the extent grew.
   */
  ensureWorldExtent(minExtent: number): boolean;
  /** Dirt-chip burst at the current dig face (manual dig). */
  burstDigParticles(): void;
  /** Subtle chip trickle at the dig face (passive dig). */
  trickleDigParticles(): void;
  /** Advance particle lifetimes (call each frame). */
  update(dtSeconds: number): void;
  dispose(): void;
}

export interface DigWorldOptions {
  /**
   * Initial solid-earth generation look-ahead (grows as the player digs).
   * Not a hard game end — The Endless Dig expands this automatically.
   */
  worldExtent?: number;
  /** Initial open shaft depth (normally 0 until the player digs). */
  excavatedDepth?: number;
}

/** Extra solid blocks kept below the dig face / scroll focus. */
export const WORLD_EXTENT_LOOKAHEAD = 64;

/** Half-disk grass radius extending away from the player (−Z). */
const SURFACE_RADIUS = 40;
const Z_FRONT = 0;
const SHAFT_XS = [-1, 0] as const;
const SHAFT_ZS = [-1, 0] as const;
const DEEP_CUT_Z = -2;
/** Cutaway wall strip half-width (blocks) — wide enough for fullscreen HD. */
const WALL_HALF = 16;
export const BLOCK_SCALE = 1.55;

const CHUNK_SIZE = 16;
/** Keep this many chunks above and below the focus chunk. */
const CHUNK_RADIUS = 3;
/** Rebase floating origin when focus drifts this many blocks from origin. */
const REBASE_THRESHOLD = 48;
/** Solid earth continuing below worldExtent so the bottom does not look clipped. */
const BELOW_EXTENT_BLOCKS = 48;

const sharedBox = new BoxGeometry(1, 1, 1);

/** Partial dig-face cubes with UVs that keep texel density (no squash). */
const partialBoxCache = new Map<number, BoxGeometry>();

/** Quantize dig-face height to 1/32 so geometry, UV, and matrix agree. */
export function quantizePartialHeight(height: number): number {
  return Math.round(height * 32) / 32;
}

function getPartialBox(height: number): BoxGeometry {
  const h = quantizePartialHeight(height);
  const key = Math.round(h * 32);
  let geo = partialBoxCache.get(key);
  if (geo) return geo;
  geo = new BoxGeometry(1, h, 1);
  // Side faces only (+x,-x,+z,-z = indices 0,1,4,5). Keep texel density.
  const uv = geo.attributes.uv as BufferAttribute;
  for (const face of [0, 1, 4, 5]) {
    for (let i = 0; i < 4; i++) {
      const idx = face * 4 + i;
      uv.setY(idx, uv.getY(idx) * h);
    }
  }
  uv.needsUpdate = true;
  partialBoxCache.set(key, geo);
  return geo;
}

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
 * Chunked cutaway world with floating-origin rebasing.
 * Cavity depth follows excavation; worldExtent is a growing generation floor.
 */
export function buildDigWorld(
  scene: Scene,
  options: DigWorldOptions = {},
): DigWorld {
  let worldExtent = Math.max(0, Math.floor(options.worldExtent ?? 1000));
  let excavatedDepth = Math.max(0, options.excavatedDepth ?? 0);
  // Allow cavity deeper than initial extent; ensureWorldExtent expands solid earth.
  if (excavatedDepth > worldExtent) {
    worldExtent = Math.ceil(excavatedDepth) + WORLD_EXTENT_LOOKAHEAD;
  }

  scene.background = createSkyColor();
  scene.fog = new Fog(new Color(0x87b7e0), 45, 100);

  const root = new Group();
  root.name = "dig-world-root";

  const content = new Group();
  content.name = "dig-world";
  content.scale.setScalar(BLOCK_SCALE);
  root.add(content);

  const particles = createDigParticles(content);
  const chunkGroups = new Map<number, Group>();

  let focusBlockY = -0.4;

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

  const loadChunk = (idx: number): void => {
    const chunk = buildChunk(
      idx,
      excavatedDepth,
      worldExtent,
      inShaft,
      onSurfaceDisk,
    );
    chunkGroups.set(idx, chunk);
    content.add(chunk);
  };

  const unloadChunk = (idx: number): void => {
    const group = chunkGroups.get(idx);
    if (!group) return;
    disposeChunkGroup(group);
    content.remove(group);
    chunkGroups.delete(idx);
  };

  const chunks = createChunkWindow({
    chunkSize: CHUNK_SIZE,
    radius: CHUNK_RADIUS,
    load: loadChunk,
    unload: unloadChunk,
    // Keep surface chunk while near the top so the half-disk does not pop.
    extraKeep: (focus) =>
      focus > -CHUNK_SIZE * (CHUNK_RADIUS + 1) ? [0] : [],
  });

  const reloadChunkIfLoaded = (idx: number): void => {
    if (!chunkGroups.has(idx)) return;
    unloadChunk(idx);
    loadChunk(idx);
  };

  const refreshCavityRange = (prevDepth: number, nextDepth: number): void => {
    const lo = Math.min(prevDepth, nextDepth);
    const hi = Math.max(prevDepth, nextDepth);
    const yStart = Math.floor(-hi) - 1;
    const yEnd = Math.ceil(-lo) + 1;
    const seen = new Set<number>();
    for (let y = yStart; y <= yEnd; y++) {
      const idx = engineChunkIndex(y, CHUNK_SIZE);
      if (seen.has(idx)) continue;
      seen.add(idx);
      reloadChunkIfLoaded(idx);
    }
  };

  const ensureWorldExtent = (minExtent: number): boolean => {
    const safe = Math.min(
      Number.MAX_SAFE_INTEGER - WORLD_EXTENT_LOOKAHEAD - 1,
      Math.max(0, minExtent),
    );
    const next = Math.max(worldExtent, Math.ceil(safe));
    if (next <= worldExtent) return false;
    worldExtent = next;
    // Rebuild loaded chunks so deep strips use the new solid floor.
    for (const idx of [...chunkGroups.keys()]) {
      reloadChunkIfLoaded(idx);
    }
    return true;
  };

  const setFocusBlockY = (blockY: number): void => {
    const minY = -(worldExtent - 1.5);
    const maxY = 2.5;
    focusBlockY = Math.min(maxY, Math.max(minY, blockY));
    floating.rebaseIfNeeded(focusBlockY);
    chunks.sync(focusBlockY);
  };

  const setExcavatedDepth = (depth: number): void => {
    const next = Math.max(0, depth);
    if (next > worldExtent - WORLD_EXTENT_LOOKAHEAD) {
      ensureWorldExtent(next + WORLD_EXTENT_LOOKAHEAD);
    }
    if (next === excavatedDepth) return;
    const prev = excavatedDepth;
    excavatedDepth = next;
    refreshCavityRange(prev, next);
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
    getExcavatedDepth: () => excavatedDepth,
    setExcavatedDepth,
    getWorldExtent: () => worldExtent,
    ensureWorldExtent,
    burstDigParticles(): void {
      particles.burst(excavatedDepth);
    },
    trickleDigParticles(): void {
      particles.trickle(excavatedDepth);
    },
    update(dtSeconds: number): void {
      particles.update(dtSeconds);
    },
    dispose(): void {
      particles.dispose();
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
  excavatedDepth: number,
  worldExtent: number,
  inShaft: (x: number, z: number) => boolean,
  onSurfaceDisk: (x: number, z: number) => boolean,
): Group {
  const { min: yMin, max: yMax } = chunkRange(index, CHUNK_SIZE);
  const buckets = new Map<BlockId, Matrix4[]>();
  const partialBuckets = new Map<BlockId, Matrix4[]>();
  let partialHeight = 0;
  const grassCaps: Matrix4[] = [];
  const minY = -worldExtent - BELOW_EXTENT_BLOCKS;

  const add = (
    id: BlockId,
    x: number,
    y: number,
    z: number,
    height = 1,
  ): void => {
    if (y < yMin || y > yMax) return;
    const h =
      height < 1 - 1e-6 ? quantizePartialHeight(height) : 1;
    if (h <= 1e-6) return;
    const m = new Matrix4();
    m.setPosition(x + 0.5, y + h / 2, z + 0.5);
    if (h < 1 - 1e-6) {
      // Dig face: UV-correct geometry; matrix uses the same quantized height.
      partialHeight = h;
      let list = partialBuckets.get(id);
      if (!list) {
        list = [];
        partialBuckets.set(id, list);
      }
      list.push(m);
      return;
    }
    let list = buckets.get(id);
    if (!list) {
      list = [];
      buckets.set(id, list);
    }
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
          placeColumnBlock(
            add,
            grassCaps,
            inShaft,
            excavatedDepth,
            minY,
            x,
            y,
            z,
            true,
          );
        }
      }
    }

    for (const [tx, tz] of TREE_SPOTS) {
      if (!onSurfaceDisk(tx, tz) || inShaft(tx, tz)) continue;
      if (Math.abs(tx) <= 3 && tz >= -4) continue;
      placeTree(add, tx, tz);
    }
  }

  // Cutaway wall strip for underground rows (through dig face + padding below).
  const stripMax = Math.min(yMax, -3);
  const stripMin = Math.max(yMin, minY);
  if (stripMax >= stripMin) {
    for (let x = -WALL_HALF; x <= WALL_HALF; x++) {
      for (let z = DEEP_CUT_Z; z <= Z_FRONT; z++) {
        for (let y = stripMax; y >= stripMin; y--) {
          placeColumnBlock(
            add,
            grassCaps,
            inShaft,
            excavatedDepth,
            minY,
            x,
            y,
            z,
            false,
          );
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

  if (partialHeight > 1e-6) {
    const geo = getPartialBox(partialHeight);
    for (const [id, matrices] of partialBuckets) {
      if (matrices.length === 0) continue;
      const mesh = new InstancedMesh(geo, getBlockMaterial(id), matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.name = "dig-face";
      group.add(mesh);
    }
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

/**
 * Remaining height (0..1) of a shaft block at integer `blockY` given excavated depth.
 * 0 = fully carved away; 1 = untouched; (0,1) = dig-face partial.
 */
export function shaftBlockRemainHeight(
  blockY: number,
  excavatedDepth: number,
): number {
  if (blockY > 0) return 1;
  const fullDepth = Math.floor(excavatedDepth);
  const frac = excavatedDepth - fullDepth;
  if (blockY > -fullDepth) return 0;
  if (frac > 1e-6 && blockY === -fullDepth) return 1 - frac;
  return 1;
}

function placeColumnBlock(
  add: (id: BlockId, x: number, y: number, z: number, height?: number) => void,
  grassCaps: Matrix4[],
  inShaft: (x: number, z: number) => boolean,
  excavatedDepth: number,
  worldMinY: number,
  x: number,
  y: number,
  z: number,
  allowGrass: boolean,
): void {
  if (y < worldMinY) return;

  if (inShaft(x, z) && y <= 0) {
    const remain = shaftBlockRemainHeight(y, excavatedDepth);
    if (remain <= 1e-6) return;
    add(strata(y), x, y, z, remain);
    return;
  }

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
      // Frees instance GPU buffers; shared geometry + materials stay cached.
      child.dispose();
      group.remove(child);
    }
  }
  group.clear();
}
