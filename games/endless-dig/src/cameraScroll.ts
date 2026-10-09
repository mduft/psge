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
  getFocusBlockY(): number;
  apply(): void;
  dispose(): void;
}

/**
 * Drag vertically to scroll logical focus; DigWorld handles chunks + floating origin.
 * Holding after a drag keeps scrolling at a speed based on distance from the press point.
 */
export function createShaftScroll(options: ShaftScrollOptions): ShaftScrollController {
  const { world, canvas, applyCamera, onTap, onFocusBlockY } = options;

  let dragging = false;
  let dragged = false;
  let pressClientY = 0;
  let holdClientY = 0;
  let pointerId: number | null = null;
  let rafId = 0;
  let lastTs = 0;

  const deadzonePx = 8;
  /** Block units per second at 100px hold offset. */
  const speedAt100px = 120;
  const dragThresholdPx = 6;

  const apply = (): void => {
    applyCamera();
    onFocusBlockY?.(world.getFocusBlockY());
  };

  const stopHoldLoop = (): void => {
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    lastTs = 0;
  };

  const holdTick = (ts: number): void => {
    if (!dragging) {
      stopHoldLoop();
      return;
    }

    if (lastTs === 0) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    const offset = holdClientY - pressClientY;
    if (Math.abs(offset) > deadzonePx) {
      if (Math.abs(offset) > dragThresholdPx) dragged = true;
      // Same direction as before: drag/hold up (negative offset) → deeper.
      const blocksPerSec = (offset / 100) * speedAt100px;
      world.setFocusBlockY(world.getFocusBlockY() + blocksPerSec * dt);
      apply();
    }

    rafId = requestAnimationFrame(holdTick);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    dragging = true;
    dragged = false;
    pressClientY = event.clientY;
    holdClientY = event.clientY;
    pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
    stopHoldLoop();
    lastTs = 0;
    rafId = requestAnimationFrame(holdTick);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== pointerId) return;
    holdClientY = event.clientY;
    if (Math.abs(holdClientY - pressClientY) > dragThresholdPx) {
      dragged = true;
    }
  };

  const endDrag = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    const wasDrag = dragged;
    dragging = false;
    pointerId = null;
    stopHoldLoop();
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
  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (dragging) e.preventDefault();
    },
    { passive: false },
  );

  apply();

  return {
    getFocusBlockY: () => world.getFocusBlockY(),
    apply,
    dispose: () => {
      stopHoldLoop();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.classList.remove("is-dragging");
    },
  };
}
