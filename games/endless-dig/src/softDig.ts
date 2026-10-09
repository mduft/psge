/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Soft-caps how much shaft depth a given dig power / passive rate actually
 * removes (§7.1). Independent of current depth — only the instantaneous
 * power or rate matters.
 *
 * Near the base step (1/32) the map stays ~linear; higher power/rate grows
 * like a log so stacked gear feels faster without becoming a blur.
 */

/**
 * Characteristic power/rate (blocks per tap or per second) where the soft
 * curve is ~0.7× linear. Sized for passive rates (cart → crews) so a few
 * dig crews still feel brisk; tap dig at 1–2/32 stays essentially full.
 */
export const SOFT_DIG_SCALE = 2;

/**
 * Map raw dig power (blocks/tap) or passive rate (blocks/s) → effective
 * blocks removed per tap, or effective blocks/s.
 */
export function softDigAmount(
  raw: number,
  scale: number = SOFT_DIG_SCALE,
): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 0;
  if (!(scale > 0) || !Number.isFinite(scale)) return raw;
  return scale * Math.asinh(raw / scale);
}

/** Focus slightly above the dig face so the floor stays in frame. */
export function focusForDepth(depth: number): number {
  return -Math.max(0, depth) + 0.35;
}
