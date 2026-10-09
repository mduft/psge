export interface ChunkWindowOptions {
  chunkSize: number;
  /** Chunks kept above and below the focus chunk (inclusive window radius). */
  radius: number;
  load: (index: number) => void;
  unload: (index: number) => void;
  /** Extra chunk indices to keep for the current focus (e.g. surface chunk). */
  extraKeep?: (focus: number) => Iterable<number>;
}

export interface ChunkWindow {
  /** Sync loaded set to a window around focus (same units as chunkIndex). */
  sync(focus: number): void;
  getLoadedIndices(): readonly number[];
  getLoadedCount(): number;
  dispose(): void;
}

/** Floor-division chunk index for a 1D axis. */
export function chunkIndex(coord: number, chunkSize: number): number {
  if (!(chunkSize > 0) || !Number.isFinite(chunkSize)) {
    throw new RangeError("chunkSize must be a positive finite number");
  }
  return Math.floor(coord / chunkSize);
}

/** Inclusive integer range covered by a chunk index. */
export function chunkRange(
  index: number,
  chunkSize: number,
): { min: number; max: number } {
  const min = index * chunkSize;
  return { min, max: min + chunkSize - 1 };
}

/**
 * Keep a bounded window of chunks around a 1D focus coordinate.
 * Caller owns load/unload side effects (meshes, GPU resources).
 */
export function createChunkWindow(options: ChunkWindowOptions): ChunkWindow {
  const { chunkSize, radius, load, unload, extraKeep } = options;
  if (!(chunkSize > 0) || !Number.isInteger(chunkSize)) {
    throw new RangeError("chunkSize must be a positive integer");
  }
  if (!(radius >= 0) || !Number.isInteger(radius)) {
    throw new RangeError("radius must be a non-negative integer");
  }

  const loaded = new Map<number, true>();

  const sync = (focus: number): void => {
    const center = chunkIndex(Math.floor(focus), chunkSize);
    const needed = new Set<number>();
    for (let i = center - radius; i <= center + radius; i++) {
      needed.add(i);
    }
    if (extraKeep) {
      for (const idx of extraKeep(focus)) {
        needed.add(idx);
      }
    }

    for (const idx of [...loaded.keys()]) {
      if (!needed.has(idx)) {
        unload(idx);
        loaded.delete(idx);
      }
    }

    for (const idx of needed) {
      if (loaded.has(idx)) continue;
      load(idx);
      loaded.set(idx, true);
    }
  };

  return {
    sync,
    getLoadedIndices: () => [...loaded.keys()].sort((a, b) => a - b),
    getLoadedCount: () => loaded.size,
    dispose(): void {
      for (const idx of [...loaded.keys()]) {
        unload(idx);
        loaded.delete(idx);
      }
    },
  };
}
