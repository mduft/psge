/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import Decimal from "decimal.js";

const NAMED_SUFFIXES = ["", "K", "M", "B", "T"] as const;

/** At least two lowercase letters: 0 → aa, 25 → az, 26 → ba, 675 → zz, 676 → aaa. */
export function tierSuffix(index: number): string {
  let n = Math.max(0, Math.floor(index));
  let length = 2;
  let start = 0;
  let span = 26 ** length;
  while (n >= start + span) {
    start += span;
    length += 1;
    span = 26 ** length;
  }
  let offset = n - start;
  let out = "";
  for (let i = 0; i < length; i++) {
    out = String.fromCharCode(97 + (offset % 26)) + out;
    offset = Math.floor(offset / 26);
  }
  return out;
}

function formatMantissa(mantissa: Decimal): string {
  // 2–3 significant digits; drop trailing zeros.
  const abs = mantissa.abs();
  let digits: number;
  if (abs.gte(100)) digits = 0;
  else if (abs.gte(10)) digits = 1;
  else digits = 2;
  const fixed = mantissa.toFixed(digits);
  if (!fixed.includes(".")) return fixed;
  return fixed.replace(/\.?0+$/, "");
}

/**
 * Idle-style compact amount: plain / K M B T / aa ab … zz / aaa …
 */
export function formatAmount(value: Decimal.Value): string {
  const n = value instanceof Decimal ? value : new Decimal(value);
  if (!n.isFinite()) return "∞";
  if (n.isZero()) return "0";
  if (n.isNeg()) return `-${formatAmount(n.abs())}`;

  const log10 = n.log(10);
  let tier = Math.floor(log10.div(3).toNumber());
  if (tier < 0) tier = 0;

  let mantissa = n.div(new Decimal(1000).pow(tier));
  // Clamp drift so mantissa stays in [1, 1000).
  while (mantissa.gte(1000)) {
    mantissa = mantissa.div(1000);
    tier += 1;
  }
  while (tier > 0 && mantissa.lt(1)) {
    mantissa = mantissa.mul(1000);
    tier -= 1;
  }

  const body = formatMantissa(mantissa);
  if (tier < NAMED_SUFFIXES.length) {
    return `${body}${NAMED_SUFFIXES[tier]!}`;
  }
  return `${body}${tierSuffix(tier - NAMED_SUFFIXES.length)}`;
}

/**
 * Depth in meters (1 block = 1 m). Keeps a few decimals below 1 m so early
 * dig power reads as "0.031" instead of an opaque fraction like 1/32.
 */
export function formatMeters(value: Decimal.Value): string {
  const n = value instanceof Decimal ? value : new Decimal(value);
  if (!n.isFinite()) return "∞";
  if (n.isZero()) return "0";
  if (n.isNeg()) return `-${formatMeters(n.abs())}`;
  if (n.gte(1)) return formatAmount(n);
  const fixed = n.toFixed(3);
  return fixed.replace(/\.?0+$/, "") || "0";
}
