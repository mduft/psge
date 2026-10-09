import { describe, expect, it, vi } from "vitest";
import { createFloatingOrigin } from "../src/floatingOrigin.js";

describe("createFloatingOrigin", () => {
  it("toRender is logical minus origin times scale", () => {
    const origin = createFloatingOrigin({ rebaseThreshold: 10, scale: 2 });
    origin.setOrigin(-40);
    expect(origin.toRender(-42)).toBeCloseTo((-42 - -40) * 2);
  });

  it("rebases when drift exceeds threshold", () => {
    const onApply = vi.fn();
    const origin = createFloatingOrigin({
      rebaseThreshold: 48,
      scale: 1.55,
      onApply,
    });
    expect(origin.rebaseIfNeeded(-10)).toBe(false);
    expect(origin.getOrigin()).toBe(0);

    expect(origin.rebaseIfNeeded(-50)).toBe(true);
    expect(origin.getOrigin()).toBe(-50);
    expect(onApply).toHaveBeenCalledWith(-50);
  });

  it("rejects non-positive threshold", () => {
    expect(() => createFloatingOrigin({ rebaseThreshold: 0 })).toThrow(RangeError);
  });
});
