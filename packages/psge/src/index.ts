/**
 * @psge/engine — public API is unfrozen. Milestone exports may change.
 * Milestone 1: createApp / startLoop / loadGltf / setCamera / dispose.
 */

export { clampDelta, DEFAULT_MAX_DELTA } from "./time.js";
export { createSeededRng, type SeededRng } from "./rng.js";
export {
  createApp,
  type CreateAppOptions,
  type PsgeApp,
  type SetCameraOptions,
} from "./app.js";
