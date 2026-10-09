/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Soft-caps how much shaft depth a given dig power / passive rate actually
 * removes (§7.1). Independent of current depth — only the instantaneous
 * power or rate matters.
 *
 * Blend of log-softening and a residual linear floor:
 *   floor·raw + (1−floor)·s·asinh(raw/s)
 * Early taps stay ~full strength; high stacks bend below linear but each
 * upgrade still contributes at least `SOFT_DIG_LINEAR_FLOOR` of its nominal
 * amount so late buys never feel pointless.
 */

/**
 * Characteristic power/rate where the asinh branch is ~0.7× linear.
 * Sized so a dig crew and mid tap gear stay brisk before the floor dominates.
 */
export const SOFT_DIG_SCALE = 3;

/**
 * Minimum fraction of nominal power/rate that always applies.
 * As raw → ∞, marginal gain → this value (never zero).
 */
export const SOFT_DIG_LINEAR_FLOOR = 0.25;

/**
 * Map raw dig power (blocks/tap) or passive rate (blocks/s) → effective
 * blocks removed per tap, or effective blocks/s.
 */
export function softDigAmount(
  raw: number,
  scale: number = SOFT_DIG_SCALE,
  linearFloor: number = SOFT_DIG_LINEAR_FLOOR,
): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 0;
  if (!(scale > 0) || !Number.isFinite(scale)) return raw;
  const floor = Math.min(1, Math.max(0, linearFloor));
  const soft = scale * Math.asinh(raw / scale);
  return floor * raw + (1 - floor) * soft;
}

/** Focus slightly above the dig face so the floor stays in frame. */
export function focusForDepth(depth: number): number {
  return -Math.max(0, depth) + 0.35;
}
