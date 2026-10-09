/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { createHoldDragScroll, type HoldDragScroll } from "@psge/engine";
import type { DigWorld } from "./world.js";

export interface ShaftScrollOptions {
  world: DigWorld;
  canvas: HTMLCanvasElement;
  /** Apply camera for current world render focus (resize-safe). */
  applyCamera: () => void;
  onTap?: () => void;
  onFocusBlockY?: (blockY: number) => void;
}

export interface ShaftScrollController {
  apply(): void;
  dispose(): void;
}

/**
 * Dig-facing wrapper: hold-drag scroll drives logical focus; DigWorld streams chunks.
 */
export function createShaftScroll(options: ShaftScrollOptions): ShaftScrollController {
  const { world, canvas, applyCamera, onTap, onFocusBlockY } = options;

  const apply = (): void => {
    applyCamera();
    onFocusBlockY?.(world.getFocusBlockY());
  };

  const drag: HoldDragScroll = createHoldDragScroll({
    element: canvas,
    axis: "y",
    // Drag/hold up (negative offset) → deeper (more negative focus).
    onScroll: (deltaUnits) => {
      world.setFocusBlockY(world.getFocusBlockY() + deltaUnits);
      apply();
    },
    onTap,
    draggingClass: "is-dragging",
  });

  apply();

  return {
    apply,
    dispose: () => drag.dispose(),
  };
}
