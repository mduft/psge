import { describe, expect, it, vi } from "vitest";
import {
  chunkIndex,
  chunkRange,
  createChunkWindow,
} from "../src/chunkWindow.js";

describe("chunkIndex / chunkRange", () => {
  it("maps negative coords with floor division", () => {
    expect(chunkIndex(-1, 16)).toBe(-1);
    expect(chunkIndex(-16, 16)).toBe(-1);
    expect(chunkIndex(-17, 16)).toBe(-2);
  });

  it("returns inclusive ranges", () => {
    expect(chunkRange(-1, 16)).toEqual({ min: -16, max: -1 });
    expect(chunkRange(0, 16)).toEqual({ min: 0, max: 15 });
  });
});

describe("createChunkWindow", () => {
  it("keeps a bounded window and unloads outside", () => {
    const loaded: number[] = [];
    const window = createChunkWindow({
      chunkSize: 16,
      radius: 1,
      load: (i) => loaded.push(i),
      unload: (i) => {
        const at = loaded.indexOf(i);
        if (at >= 0) loaded.splice(at, 1);
      },
    });

    window.sync(0);
    expect(loaded.sort((a, b) => a - b)).toEqual([-1, 0, 1]);

    window.sync(-100);
    expect(window.getLoadedCount()).toBe(3);
    expect(Math.max(...window.getLoadedIndices())).toBeLessThanOrEqual(
      chunkIndex(-100, 16) + 1,
    );
  });

  it("honors extraKeep", () => {
    const load = vi.fn();
    const unload = vi.fn();
    const window = createChunkWindow({
      chunkSize: 16,
      radius: 0,
      load,
      unload,
      extraKeep: () => [0],
    });
    window.sync(-200);
    expect(load).toHaveBeenCalledWith(chunkIndex(-200, 16));
    expect(load).toHaveBeenCalledWith(0);
  });

  it("dispose unloads everything", () => {
    const unload = vi.fn();
    const window = createChunkWindow({
      chunkSize: 16,
      radius: 1,
      load: () => {},
      unload,
    });
    window.sync(0);
    window.dispose();
    expect(unload).toHaveBeenCalled();
    expect(window.getLoadedCount()).toBe(0);
  });
});
