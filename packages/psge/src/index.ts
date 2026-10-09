/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
/**
 * @psge/engine — public API is unfrozen. Milestone exports may change.
 *
 * Bootstrap: createApp / startLoop / stopLoop / loadGltf / setCamera / dispose
 * Time/RNG: clampDelta / createSeededRng
 * Deep worlds: createFloatingOrigin / createChunkWindow / chunkIndex
 * Input: createHoldDragScroll
 */

export { clampDelta, DEFAULT_MAX_DELTA } from "./time.js";
export { createSeededRng, type SeededRng } from "./rng.js";
export {
  createApp,
  type CameraBootstrapOptions,
  type CreateAppOptions,
  type LightingOptions,
  type PsgeApp,
  type SetCameraOptions,
  type Vec3,
} from "./app.js";
export {
  createFloatingOrigin,
  type FloatingOrigin,
  type FloatingOriginOptions,
} from "./floatingOrigin.js";
export {
  chunkIndex,
  chunkRange,
  createChunkWindow,
  type ChunkWindow,
  type ChunkWindowOptions,
} from "./chunkWindow.js";
export {
  createHoldDragScroll,
  type HoldDragScroll,
  type HoldDragScrollOptions,
} from "./holdDragScroll.js";
