/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Aspect-aware side-view framing so wide / fullscreen layouts fill with earth
 * instead of showing sky past the cutaway strip.
 */

export interface DigCameraFraming {
  /** Camera distance along +Z (world units before look). */
  distance: number;
  /** Eye offset to the right of the shaft (block units). */
  xOffset: number;
  /** Shared pan on eye + lookAt (block units, usually slightly left). */
  panXBlocks: number;
}

/**
 * Pick dig-camera framing for the current canvas aspect (width / height).
 * Wider viewports move closer so the cutaway fills the frame.
 */
export function digCameraFraming(aspect: number): DigCameraFraming {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  // Portrait phones — pull back to keep the shaft readable.
  if (a < 0.85) {
    return { distance: 34, xOffset: 1.4, panXBlocks: -0.3 };
  }
  // Near-square / small windows.
  if (a < 1.15) {
    return { distance: 30, xOffset: 2.6, panXBlocks: -0.6 };
  }
  // Typical landscape (~16:10 and below).
  if (a < 1.6) {
    return { distance: 24, xOffset: 2.8, panXBlocks: -0.65 };
  }
  // Full HD / 16:9 fullscreen.
  if (a < 2.2) {
    return { distance: 20, xOffset: 3.0, panXBlocks: -0.7 };
  }
  // Ultrawide.
  return { distance: 17, xOffset: 3.2, panXBlocks: -0.75 };
}
