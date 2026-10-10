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
  type Camera,
  type Scene,
} from "three";
import { getBlockMaterial, getDigFaceMaterials } from "./blockMaterials.js";
import { createSkyColor, type BlockId, type PaletteFamily } from "./blockTextures.js";
import type { BoosterProgress } from "./boosters.js";
import type { SpecialCoinProgress } from "./specialCoins.js";
import {
  createShaftCoinProps,
  type ShaftCoinPick,
} from "./shaftCoinProps.js";
import { DIG_SHAFT_XS, DIG_SHAFT_ZS, isDigShaftCell } from "./digShaft.js";
import { createDigParticles } from "./digParticles.js";
import {
  chipColorsForDepth,
  geoLayerAt,
  wallAccentAt,
  wallAccentVariant,
} from "./geoLayers.js";
import { isMineshaftAir } from "./mineshafts.js";
import {
  createMineshaftProps,
  type MineshaftCartPick,
  type MineshaftBarrelPick,
  type MineshaftSyncResult,
} from "./mineshaftProps.js";
import { createShaftActors, type ShaftActors } from "./shaftActors.js";
import type { UpgradeLevels } from "./upgrades.js";

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
  /** Fog / sky / particle palette for the geo layer at `depth`. */
  applyEnvironment(depth: number): void;
  /**
   * Scale authored fog near/far for the current camera distance
   * (narrow panels pull back — without this, deep layers vanish).
   */
  setFogDistanceScale(scale: number): void;
  /** Sync digger + machinery to dig face and upgrades. */
  syncActors(excavatedDepth: number, upgrades: UpgradeLevels): void;
  /** Sync side-mineshaft décor near the dig face. */
  syncMineshafts(
    excavatedDepth: number,
    claimedCartIds?: ReadonlySet<string>,
    claimedBarrelIds?: ReadonlySet<string>,
  ): MineshaftSyncResult;
  /** Sync visible dirt + special coins; returns count of newly appeared coins. */
  syncShaftCoins(
    excavatedDepth: number,
    worldSeed: number,
    boosters: BoosterProgress,
    special: SpecialCoinProgress,
  ): number;
  /** NDC ray pick against shaft coins (−1…1). */
  pickShaftCoin(
    camera: Camera,
    ndcX: number,
    ndcY: number,
  ): ShaftCoinPick | null;
  /** Hover highlight for a shaft coin (or clear). */
  setShaftCoinHover(pick: ShaftCoinPick | null): void;
  /** NDC ray pick against looting minecarts (−1…1). */
  pickMinecart(
    camera: Camera,
    ndcX: number,
    ndcY: number,
  ): MineshaftCartPick | null;
  setMinecartHover(pick: MineshaftCartPick | null): void;
  markMinecartClaimed(id: string): void;
  /** NDC ray pick against looting barrels (−1…1). */
  pickBarrel(
    camera: Camera,
    ndcX: number,
    ndcY: number,
  ): MineshaftBarrelPick | null;
  setBarrelHover(pick: MineshaftBarrelPick | null): void;
  markBarrelClaimed(id: string): void;
  playDigSwing(): void;
  playCrewChip(): void;
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
   * Not a hard game end — Digger expands this automatically.
   */
  worldExtent?: number;
  /** Initial open shaft depth (normally 0 until the player digs). */
  excavatedDepth?: number;
}

/** Extra solid blocks kept below the dig face / scroll focus. */
export const WORLD_EXTENT_LOOKAHEAD = 64;
/**
 * Grow the solid-earth floor in coarse steps. Growing by 1 m each dig used to
 * reload every loaded chunk every full block once depth sat within lookahead
 * of the extent (common after `?depth=` / layer jumps) — felt like a hitch.
 */
export const WORLD_EXTENT_GROW_STEP = 256;

/** Ceil `minExtent` to the next grow step (testable helper). */
export function roundWorldExtentUp(minExtent: number): number {
  const step = WORLD_EXTENT_GROW_STEP;
  const safe = Math.min(
    Number.MAX_SAFE_INTEGER - step - 1,
    Math.max(0, minExtent),
  );
  return Math.ceil(safe / step) * step;
}

/** Half-disk grass radius extending away from the player (−Z). */
const SURFACE_RADIUS = 40;
const Z_FRONT = 0;
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

/** Snap excavated depth to the dig-face geometry grid (1/32 block). */
export function quantizeExcavatedDepth(depth: number): number {
  if (!(depth > 0) || !Number.isFinite(depth)) return 0;
  return Math.round(depth * 32) / 32;
}

/**
 * Coarse dig-face wear 0…7 from remaining height. Intentionally coarser than
 * the 1/32 geometry grid so the top texture does not thrash during auto-dig.
 */
export function digFaceWearLevel(height: number): number {
  const h = quantizePartialHeight(height);
  const step = Math.max(0, Math.min(32, Math.round(h * 32)));
  const dug = 32 - step;
  return Math.min(7, Math.floor(dug / 4));
}

/** Chunk solid structure key — changes only when layers appear/disappear. */
export function cavityStructureKey(depth: number): string {
  const q = quantizeExcavatedDepth(depth);
  const full = Math.floor(q);
  const partial = q - full > 1e-6 ? 1 : 0;
  return `${full}:${partial}`;
}

function getPartialBox(height: number): BoxGeometry {
  const h = quantizePartialHeight(height);
  const key = Math.round(h * 32);
  let geo = partialBoxCache.get(key);
  if (geo) return geo;
  geo = new BoxGeometry(1, h, 1);
  // Side faces only (+x,-x,+z,-z = indices 0,1,4,5). Keep texel density.
  // Top UVs stay full 0–1 so the painted block border never slides.
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
  let excavatedDepth = quantizeExcavatedDepth(options.excavatedDepth ?? 0);

  // Allow cavity deeper than initial extent; pad in coarse grow steps.
  if (excavatedDepth > worldExtent - WORLD_EXTENT_LOOKAHEAD) {
    worldExtent = Math.max(
      worldExtent,
      roundWorldExtentUp(excavatedDepth + WORLD_EXTENT_LOOKAHEAD),
    );
  }

  scene.background = createSkyColor("soil");
  scene.fog = new Fog(new Color(0x87b7e0), 22, 55);

  const root = new Group();
  root.name = "dig-world-root";

  const content = new Group();
  content.name = "dig-world";
  content.scale.setScalar(BLOCK_SCALE);
  root.add(content);

  const particles = createDigParticles(content);
  const actors: ShaftActors = createShaftActors(content);
  const mineshaftProps = createMineshaftProps(content);
  const shaftCoins = createShaftCoinProps(content);
  const chunkGroups = new Map<number, Group>();
  /** Dig-face partials live here so intra-block dig does not reload chunks. */
  const digFaceRoot = new Group();
  digFaceRoot.name = "dig-face-overlay";
  content.add(digFaceRoot);

  let fogDistanceScale = 1;

  const applyEnvironment = (depth: number): void => {
    const layer = geoLayerAt(depth);
    const sky = new Color(layer.mood.sky);
    scene.background = sky;
    if (scene.fog instanceof Fog) {
      scene.fog.color.copy(sky);
      const s = fogDistanceScale;
      scene.fog.near = layer.mood.fogNear * s;
      scene.fog.far = layer.mood.fogFar * s;
    }
    particles.setChipColors(chipColorsForDepth(depth));
  };
  applyEnvironment(excavatedDepth);

  const setFogDistanceScale = (scale: number): void => {
    const next =
      Number.isFinite(scale) && scale > 0
        ? Math.min(2.5, Math.max(0.5, scale))
        : 1;
    if (Math.abs(next - fogDistanceScale) < 1e-6) return;
    fogDistanceScale = next;
    applyEnvironment(excavatedDepth);
  };

  let focusBlockY = -0.4;

  const floating = createFloatingOrigin({
    rebaseThreshold: REBASE_THRESHOLD,
    scale: BLOCK_SCALE,
    onApply: (origin) => {
      root.position.y = -origin * BLOCK_SCALE;
    },
  });

  const inShaft = isDigShaftCell;

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

  const rebuildDigFaceOverlay = (): void => {
    disposeChunkGroup(digFaceRoot);
    const q = excavatedDepth;
    const fullDepth = Math.floor(q);
    const frac = q - fullDepth;
    if (frac <= 1e-6) return;
    const remain = quantizePartialHeight(1 - frac);
    if (remain <= 1e-6) return;
    const blockY = -fullDepth;
    const geo = getPartialBox(remain);
    const byId = new Map<BlockId, Matrix4[]>();
    for (const x of DIG_SHAFT_XS) {
      for (const z of DIG_SHAFT_ZS) {
        const id = strataAt(x, blockY, z);
        const m = new Matrix4();
        m.setPosition(x + 0.5, blockY + remain / 2, z + 0.5);
        let list = byId.get(id);
        if (!list) {
          list = [];
          byId.set(id, list);
        }
        list.push(m);
      }
    }
    for (const [id, matrices] of byId) {
      // Dig face sits at one depth — use shaft-center family for the band.
      const family = geoLayerAt(fullDepth, 0, 0).id as PaletteFamily;
      const mesh = new InstancedMesh(
        geo,
        getDigFaceMaterials(id, remain, family),
        matrices.length,
      );
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.name = "dig-face";
      digFaceRoot.add(mesh);
    }
  };

  const ensureWorldExtent = (minExtent: number): boolean => {
    const next = Math.max(worldExtent, roundWorldExtentUp(minExtent));
    if (next <= worldExtent) return false;
    const prevExtent = worldExtent;
    worldExtent = next;
    // Only chunks that intersect the newly solid band need a rebuild —
    // dig-face / mid-shaft strips are unchanged when the floor drops.
    const oldFloorY = -prevExtent - BELOW_EXTENT_BLOCKS;
    const newFloorY = -worldExtent - BELOW_EXTENT_BLOCKS;
    for (const idx of [...chunkGroups.keys()]) {
      const { min, max } = chunkRange(idx, CHUNK_SIZE);
      if (min > oldFloorY) continue;
      if (max < newFloorY) continue;
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
    const raw = Math.max(0, depth);
    if (raw > worldExtent - WORLD_EXTENT_LOOKAHEAD) {
      ensureWorldExtent(raw + WORLD_EXTENT_LOOKAHEAD);
    }
    const next = quantizeExcavatedDepth(raw);
    if (next === excavatedDepth) return;
    const prev = excavatedDepth;
    const structureChanged =
      cavityStructureKey(prev) !== cavityStructureKey(next);
    excavatedDepth = next;
    // Full chunk reload only when solid layers appear/disappear — not every
    // 1/32 while auto-digging through the same block (that was the stutter).
    if (structureChanged) refreshCavityRange(prev, next);
    rebuildDigFaceOverlay();
    // Fog / sky / chips: owned by main.applyLayerMood → applyEnvironment so
    // lights and fog stay on one path (avoid double-apply every dig).
  };

  scene.add(root);
  floating.setOrigin(0);
  chunks.sync(focusBlockY);
  rebuildDigFaceOverlay();

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
    applyEnvironment,
    setFogDistanceScale,
    syncActors(depth: number, upgrades: UpgradeLevels): void {
      actors.sync(depth, upgrades);
    },
    syncMineshafts(depth, claimedCartIds, claimedBarrelIds): MineshaftSyncResult {
      return mineshaftProps.sync(depth, claimedCartIds, claimedBarrelIds);
    },
    syncShaftCoins(
      depth: number,
      worldSeed: number,
      boosters: BoosterProgress,
      special: SpecialCoinProgress,
    ): number {
      return shaftCoins.sync(depth, worldSeed, boosters, special);
    },
    pickShaftCoin(
      camera: Camera,
      ndcX: number,
      ndcY: number,
    ): ShaftCoinPick | null {
      return shaftCoins.pick(camera, ndcX, ndcY);
    },
    setShaftCoinHover(pick: ShaftCoinPick | null): void {
      shaftCoins.setHover(pick);
    },
    pickMinecart(camera, ndcX, ndcY): MineshaftCartPick | null {
      return mineshaftProps.pickCart(camera, ndcX, ndcY);
    },
    setMinecartHover(pick: MineshaftCartPick | null): void {
      mineshaftProps.setCartHover(pick);
    },
    markMinecartClaimed(id: string): void {
      mineshaftProps.markCartClaimed(id);
    },
    pickBarrel(camera, ndcX, ndcY): MineshaftBarrelPick | null {
      return mineshaftProps.pickBarrel(camera, ndcX, ndcY);
    },
    setBarrelHover(pick: MineshaftBarrelPick | null): void {
      mineshaftProps.setBarrelHover(pick);
    },
    markBarrelClaimed(id: string): void {
      mineshaftProps.markBarrelClaimed(id);
    },
    playDigSwing(): void {
      actors.playDigSwing();
    },
    playCrewChip(): void {
      actors.playCrewChip();
    },
    burstDigParticles(): void {
      particles.burst(excavatedDepth);
    },
    trickleDigParticles(): void {
      particles.trickle(excavatedDepth);
    },
    update(dtSeconds: number): void {
      particles.update(dtSeconds);
      actors.update(dtSeconds);
      shaftCoins.update(dtSeconds);
      mineshaftProps.update(dtSeconds);
    },
    dispose(): void {
      actors.dispose();
      shaftCoins.dispose();
      mineshaftProps.dispose();
      particles.dispose();
      disposeChunkGroup(digFaceRoot);
      chunks.dispose();
      scene.remove(root);
      scene.fog = null;
    },
  };
}

/** Minimum thickness kept when independent boundary warps would cross. */
const MIN_LAYER_THICKNESS = 2;

const DEEP_BANDS = ["deepslate", "stone", "granite", "cobble"] as const;
/** Nominal start / thickness of the repeating deep-band stack (below granite). */
const DEEP_BAND_BASE = 12;
const DEEP_BAND_STEP = 8;

type WarpProfile = { cell: number; amp: number; seed: number };

/** Named contacts — each gets its own frequency/seed so seams do not stack. */
const BOUNDARY_DIRT_STONE: WarpProfile = { cell: 6, amp: 2.5, seed: 0x11a3 };
const BOUNDARY_STONE_GRANITE: WarpProfile = { cell: 11, amp: 4, seed: 0x22b7 };
const BOUNDARY_GRANITE_DEEP: WarpProfile = { cell: 9, amp: 3.5, seed: 0x33c1 };
/** Single deep-stack warp — O(1) band index (no per-contact walk). */
const BOUNDARY_DEEP_BANDS: WarpProfile = { cell: 10, amp: 4, seed: 0x50de };

function layerLatticeHash(ix: number, iz: number, seed: number): number {
  let n =
    Math.imul(ix | 0, 374761393) +
    Math.imul(iz | 0, 668265263) +
    (seed | 0);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * Per-boundary depth offset. Bilinear value noise with amp ≤ cell/2 keeps
 * |Δ| ≤ 1 for 4-neighbors; total undulation may span several blocks.
 */
export function boundaryWarp(
  x: number,
  z: number,
  profile: WarpProfile,
): number {
  const cell = profile.cell;
  const amp = Math.min(profile.amp, cell / 2);
  const fx = x / cell;
  const fz = z / cell;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = fx - x0;
  const tz = fz - z0;
  const v = (ix: number, iz: number) =>
    (layerLatticeHash(ix, iz, profile.seed) * 2 - 1) * amp;
  const a = v(x0, z0) + (v(x0 + 1, z0) - v(x0, z0)) * tx;
  const b = v(x0, z0 + 1) + (v(x0 + 1, z0 + 1) - v(x0, z0 + 1)) * tx;
  return a + (b - a) * tz;
}

/** Dirt/stone contact warp (test helper / single-field sample). */
export function layerWarp(x: number, z: number): number {
  return boundaryWarp(x, z, BOUNDARY_DIRT_STONE);
}

/**
 * Block material at (x,y,z). Shallow contacts undulate independently; deeper
 * repeating bands use one warped depth → index map (O(1)). The old per-contact
 * walk (up to 512 warps/cell) made every full-block chunk rebuild hitch once
 * depth passed a few km.
 */
export function strataAt(x: number, y: number, z: number): BlockId {
  const d = -y;
  const tDirt =
    3 + boundaryWarp(x, z, BOUNDARY_DIRT_STONE);
  const tStone = Math.max(
    tDirt + MIN_LAYER_THICKNESS,
    7 + boundaryWarp(x, z, BOUNDARY_STONE_GRANITE),
  );
  const tGranite = Math.max(
    tStone + MIN_LAYER_THICKNESS,
    DEEP_BAND_BASE + boundaryWarp(x, z, BOUNDARY_GRANITE_DEEP),
  );
  if (d <= tDirt) return "dirt";
  if (d <= tStone) return "stone";
  if (d < tGranite) return "granite";

  const warped =
    d - boundaryWarp(x, z, BOUNDARY_DEEP_BANDS);
  const i = Math.max(
    0,
    Math.floor((warped - DEEP_BAND_BASE) / DEEP_BAND_STEP),
  );
  return DEEP_BANDS[i & 3]!;
}

function buildChunk(
  index: number,
  excavatedDepth: number,
  worldExtent: number,
  inShaft: (x: number, z: number) => boolean,
  onSurfaceDisk: (x: number, z: number) => boolean,
): Group {
  const { min: yMin, max: yMax } = chunkRange(index, CHUNK_SIZE);
  type Bucket = {
    id: BlockId;
    family: PaletteFamily;
    variant: number;
    under?: BlockId;
    matrices: Matrix4[];
  };
  const buckets = new Map<string, Bucket>();
  const grassCaps: Matrix4[] = [];
  const minY = -worldExtent - BELOW_EXTENT_BLOCKS;

  const add = (
    id: BlockId,
    x: number,
    y: number,
    z: number,
    height = 1,
    accent?: { variant: number; under?: BlockId },
  ): void => {
    if (y < yMin || y > yMax) return;
    const h =
      height < 1 - 1e-6 ? quantizePartialHeight(height) : 1;
    // Partials are drawn by digFaceRoot overlay — skip here to avoid chunk thrash.
    if (h <= 1e-6 || h < 1 - 1e-6) return;
    const family = geoLayerAt(Math.max(0, -y), x, z).id as PaletteFamily;
    const variant = accent?.variant ?? 0;
    const under = accent?.under;
    const key =
      id === "lava" || id === "gem"
        ? `${family}:${id}:${variant}:${under ?? ""}`
        : `${family}:${id}`;
    const m = new Matrix4();
    m.setPosition(x + 0.5, y + h / 2, z + 0.5);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { id, family, variant, under, matrices: [] };
      buckets.set(key, bucket);
    }
    bucket.matrices.push(m);
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

  for (const { id, family, variant, under, matrices } of buckets.values()) {
    if (matrices.length === 0) continue;
    const mesh = new InstancedMesh(
      sharedBox,
      getBlockMaterial(id, family, { variant, under }),
      matrices.length,
    );
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  if (grassCaps.length > 0) {
    const mesh = new InstancedMesh(
      sharedBox,
      getBlockMaterial("grass", "soil"),
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
  add: (
    id: BlockId,
    x: number,
    y: number,
    z: number,
    height?: number,
    accent?: { variant: number; under?: BlockId },
  ) => void,
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

  // Shaft path never gets lava/gem — accents would vanish as you dig through.
  if (inShaft(x, z) && y <= 0) {
    const remain = shaftBlockRemainHeight(y, excavatedDepth);
    if (remain <= 1e-6) return;
    add(strataAt(x, y, z), x, y, z, remain);
    return;
  }

  // Abandoned side tunnels (carved regardless of dig progress).
  if (isMineshaftAir(x, y, z)) return;

  const base = strataAt(x, y, z);
  const accent = wallAccentAt(x, y, z);
  if (accent) {
    add(accent, x, y, z, 1, {
      variant: wallAccentVariant(x, y, z),
      under: accent === "gem" ? base : undefined,
    });
  } else {
    add(base, x, y, z);
  }

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
