/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
export interface HoldDragScrollOptions {
  element: HTMLElement;
  /** Scroll axis in screen space. Default "y". */
  axis?: "x" | "y";
  deadzonePx?: number;
  dragThresholdPx?: number;
  /** Units/sec at 100px hold offset. Default 120. */
  speedAt100px?: number;
  /**
   * Called each animation frame while holding past the deadzone.
   * `deltaUnits` is already scaled by dt (add directly to focus).
   */
  onScroll: (deltaUnits: number, dtSeconds: number) => void;
  onTap?: () => void;
  /** CSS class toggled while a pointer is down. */
  draggingClass?: string;
  /** Max simulation step for hold loop. Default 0.05s. */
  maxDeltaSeconds?: number;
}

export interface HoldDragScroll {
  /** When false, hold-drag scroll is ignored; taps still fire `onTap`. */
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  dispose(): void;
}

/**
 * Press-and-hold drag scroll: offset from press point drives continuous scroll
 * speed. A short press without drag fires onTap.
 */
export function createHoldDragScroll(
  options: HoldDragScrollOptions,
): HoldDragScroll {
  const {
    element,
    axis = "y",
    deadzonePx = 8,
    dragThresholdPx = 6,
    speedAt100px = 120,
    onScroll,
    onTap,
    draggingClass = "is-dragging",
    maxDeltaSeconds = 0.05,
  } = options;

  let enabled = true;
  let dragging = false;
  let dragged = false;
  let pressClient = 0;
  let holdClient = 0;
  let pointerId: number | null = null;
  let rafId = 0;
  let lastTs = 0;

  const clientOf = (event: PointerEvent): number =>
    axis === "y" ? event.clientY : event.clientX;

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
    const dt = Math.min(maxDeltaSeconds, (ts - lastTs) / 1000);
    lastTs = ts;

    const offset = holdClient - pressClient;
    if (enabled && Math.abs(offset) > deadzonePx) {
      if (Math.abs(offset) > dragThresholdPx) dragged = true;
      const unitsPerSec = (offset / 100) * speedAt100px;
      onScroll(unitsPerSec * dt, dt);
    }

    rafId = requestAnimationFrame(holdTick);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    dragging = true;
    dragged = false;
    pressClient = clientOf(event);
    holdClient = pressClient;
    pointerId = event.pointerId;
    element.setPointerCapture(event.pointerId);
    if (draggingClass) element.classList.add(draggingClass);
    stopHoldLoop();
    lastTs = 0;
    rafId = requestAnimationFrame(holdTick);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== pointerId) return;
    holdClient = clientOf(event);
    if (
      enabled &&
      Math.abs(holdClient - pressClient) > dragThresholdPx
    ) {
      dragged = true;
    }
  };

  const endDrag = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    const wasDrag = dragged;
    dragging = false;
    pointerId = null;
    stopHoldLoop();
    if (draggingClass) element.classList.remove(draggingClass);
    try {
      element.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
    if (!wasDrag) onTap?.();
  };

  const onTouchMove = (event: TouchEvent): void => {
    if (dragging) event.preventDefault();
  };

  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerup", endDrag);
  element.addEventListener("pointercancel", endDrag);
  element.addEventListener("touchmove", onTouchMove, { passive: false });

  return {
    setEnabled(next: boolean): void {
      enabled = next;
      if (!enabled) {
        stopHoldLoop();
        if (draggingClass) element.classList.remove(draggingClass);
      }
    },
    isEnabled: () => enabled,
    dispose(): void {
      stopHoldLoop();
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", endDrag);
      element.removeEventListener("pointercancel", endDrag);
      element.removeEventListener("touchmove", onTouchMove);
      if (draggingClass) element.classList.remove(draggingClass);
    },
  };
}
