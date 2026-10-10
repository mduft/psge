/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from "vitest";
import {
  DISCOVERY_DEFS,
  emptyDiscoveryProgress,
  resolveDiscoveries,
  unlockNextDiscovery,
} from "../src/discoveries.js";

describe("resolveDiscoveries", () => {
  it("unlocks milestones when depth crosses their threshold", () => {
    const progress = emptyDiscoveryProgress(42);
    const { newlyUnlocked } = resolveDiscoveries(progress, 20, 30);
    expect(newlyUnlocked).toContain("bone_shard");
    expect(progress.unlocked).toContain("bone_shard");
  });

  it("does not re-unlock the same milestone", () => {
    const progress = emptyDiscoveryProgress(42);
    resolveDiscoveries(progress, 0, 30);
    const second = resolveDiscoveries(progress, 30, 40);
    expect(second.newlyUnlocked).not.toContain("bone_shard");
  });

  it("is deterministic for the same world seed and span", () => {
    const a = emptyDiscoveryProgress(99_001);
    const b = emptyDiscoveryProgress(99_001);
    const ra = resolveDiscoveries(a, 0, 500);
    const rb = resolveDiscoveries(b, 0, 500);
    expect(ra.newlyUnlocked).toEqual(rb.newlyUnlocked);
    expect(a.unlocked).toEqual(b.unlocked);
  });

  it("different seeds can diverge on roll finds", () => {
    const results = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const p = emptyDiscoveryProgress(seed);
      resolveDiscoveries(p, 0, 800);
      results.add(p.unlocked.filter((id) => id !== "bone_shard").join(","));
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it("unlockNextDiscovery walks the catalog without duplicates", () => {
    const progress = emptyDiscoveryProgress(1);
    const ids: string[] = [];
    for (let i = 0; i < DISCOVERY_DEFS.length + 2; i++) {
      const id = unlockNextDiscovery(progress);
      if (id) ids.push(id);
    }
    expect(ids).toHaveLength(DISCOVERY_DEFS.length);
    expect(new Set(ids).size).toBe(DISCOVERY_DEFS.length);
    expect(unlockNextDiscovery(progress)).toBeNull();
  });
});
