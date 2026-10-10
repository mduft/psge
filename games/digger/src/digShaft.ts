/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Shared 2×2 dig-shaft footprint (XZ). Used by world placement and accents
 * so lava/gem/iron accents never occupy the cavity path.
 */

export const DIG_SHAFT_XS = [-1, 0] as const;
export const DIG_SHAFT_ZS = [-1, 0] as const;

export function isDigShaftCell(x: number, z: number): boolean {
  return (
    (DIG_SHAFT_XS as readonly number[]).includes(x) &&
    (DIG_SHAFT_ZS as readonly number[]).includes(z)
  );
}
