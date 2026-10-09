import type { PsgeApp } from "@psge/engine";
import { BLOCK_SCALE } from "./world.js";

export interface ShaftScrollOptions {
  app: PsgeApp;
  canvas: HTMLCanvasElement;
  /** Initial focus Y (world space, already scaled). */
  initialFocusY: number;
  /** Shaft depth in blocks (unscaled). */
  shaftDepthBlocks: number;
  /** Called whenever focus Y changes (after clamp). */
  onFocusY?: (focusY: number) => void;
  /** Dig tap when pointer up without a drag. */
  onTap?: () => void;
}

export interface ShaftScrollController {
  getFocusY(): number;
  /** Re-apply camera for current focus (e.g. after resize). */
  apply(): void;
  dispose(): void;
}

/**
 * Drag vertically on the canvas to move the locked camera up/down the shaft.
 * Orientation stays fixed; only the focus height changes.
 */
export function createShaftScroll(options: ShaftScrollOptions): ShaftScrollController {
  const { app, canvas, shaftDepthBlocks, onFocusY, onTap } = options;

  // Surface apron slightly above ground; bottom near the shaft floor.
  const maxFocusY = 2.5 * BLOCK_SCALE;
  const minFocusY = -(shaftDepthBlocks - 1.5) * BLOCK_SCALE;

  let focusY = clamp(options.initialFocusY, minFocusY, maxFocusY);
  let dragging = false;
  let dragged = false;
  let lastClientY = 0;
  let pointerId: number | null = null;

  // World units per pixel — tuned so a short drag covers a useful stretch of shaft.
  const sensitivity = 0.045 * BLOCK_SCALE;

  const apply = (): void => {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const distance = aspect < 0.85 ? 34 : aspect < 1.15 ? 30 : 27;
    const xOffset = aspect < 0.85 ? 1.4 : 2.6;
    const yLift = 8.5;

    app.setCamera({
      position: [xOffset * BLOCK_SCALE, focusY + yLift, distance],
      lookAt: [0, focusY - 1.5, -6 * BLOCK_SCALE],
    });
    onFocusY?.(focusY);
  };

  const setFocusY = (next: number): void => {
    const clamped = clamp(next, minFocusY, maxFocusY);
    if (clamped === focusY) return;
    focusY = clamped;
    apply();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    dragging = true;
    dragged = false;
    lastClientY = event.clientY;
    pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== pointerId) return;
    const dy = event.clientY - lastClientY;
    if (Math.abs(dy) > 2) dragged = true;
    lastClientY = event.clientY;
    // Drag mouse down → camera descends; drag up → rise toward surface.
    setFocusY(focusY - dy * sensitivity);
  };

  const endDrag = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    const wasDrag = dragged;
    dragging = false;
    pointerId = null;
    canvas.classList.remove("is-dragging");
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
    if (!wasDrag) onTap?.();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  // Prevent touch page scroll while dragging the dig site.
  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (dragging) e.preventDefault();
    },
    { passive: false },
  );

  apply();

  return {
    getFocusY: () => focusY,
    apply,
    dispose: () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.classList.remove("is-dragging");
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
