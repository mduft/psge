/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { formatAmount, tierSuffix } from "../src/formatAmount.js";

describe("tierSuffix", () => {
  it("starts at aa and advances", () => {
    expect(tierSuffix(0)).toBe("aa");
    expect(tierSuffix(1)).toBe("ab");
    expect(tierSuffix(25)).toBe("az");
    expect(tierSuffix(26)).toBe("ba");
    expect(tierSuffix(675)).toBe("zz");
    expect(tierSuffix(676)).toBe("aaa");
  });
});

describe("formatAmount", () => {
  it("formats plain and named tiers", () => {
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(12)).toBe("12");
    expect(formatAmount(3.5)).toBe("3.5");
    expect(formatAmount(2100)).toBe("2.1K");
    expect(formatAmount(2_100_000)).toBe("2.1M");
    expect(formatAmount(2.1e9)).toBe("2.1B");
    expect(formatAmount(2.1e12)).toBe("2.1T");
  });

  it("uses aa letter pairs from 1e15", () => {
    expect(formatAmount(2.1e15)).toBe("2.1aa");
    expect(formatAmount(2.1e18)).toBe("2.1ab");
  });

  it("grows to three letters past zz", () => {
    // tier 5 = aa … tier 5+675 = zz → tier 5+676 = aaa at 1000^(5+676)
    const n = new Decimal(1000).pow(5 + 676).mul(2.1);
    expect(formatAmount(n)).toBe("2.1aaa");
  });

  it("handles negatives", () => {
    expect(formatAmount(-2100)).toBe("-2.1K");
  });
});
