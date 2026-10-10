/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isNewerBuild,
  parseVersionManifest,
  startUpdateCheck,
  versionManifestUrl,
} from "../src/updateCheck.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parseVersionManifest", () => {
  it("accepts version + buildId", () => {
    expect(
      parseVersionManifest({ version: "0.9.0", buildId: "0.9.0+abc" }),
    ).toEqual({ version: "0.9.0", buildId: "0.9.0+abc" });
  });

  it("rejects incomplete payloads", () => {
    expect(parseVersionManifest(null)).toBeNull();
    expect(parseVersionManifest({ version: "1" })).toBeNull();
    expect(parseVersionManifest({ buildId: "x" })).toBeNull();
  });
});

describe("isNewerBuild", () => {
  it("compares build ids and ignores dev", () => {
    expect(isNewerBuild({ version: "1", buildId: "a" }, "b")).toBe(true);
    expect(isNewerBuild({ version: "1", buildId: "a" }, "a")).toBe(false);
    expect(isNewerBuild({ version: "1", buildId: "a" }, "dev")).toBe(false);
  });
});

describe("versionManifestUrl", () => {
  it("joins BASE_URL", () => {
    expect(versionManifestUrl("/")).toBe("/version.json");
    expect(versionManifestUrl("/game/")).toBe("/game/version.json");
    expect(versionManifestUrl("/game")).toBe("/game/version.json");
  });
});

describe("startUpdateCheck", () => {
  it("announces when remote buildId differs", async () => {
    const onUpdate = vi.fn();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: "0.9.1", buildId: "0.9.1+new" }),
    })) as unknown as typeof fetch;

    const handle = startUpdateCheck({
      localBuildId: "0.9.0+old",
      onUpdateAvailable: onUpdate,
      fetchImpl,
      now: () => 1,
      enabled: true,
      immediate: false,
      pollMs: 60_000,
    });

    await expect(handle.checkNow()).resolves.toBe(true);
    expect(onUpdate).toHaveBeenCalledWith({
      version: "0.9.1",
      buildId: "0.9.1+new",
    });
    handle.dispose();
  });

  it("stays quiet when build matches", async () => {
    const onUpdate = vi.fn();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: "0.9.0", buildId: "same" }),
    })) as unknown as typeof fetch;

    const handle = startUpdateCheck({
      localBuildId: "same",
      onUpdateAvailable: onUpdate,
      fetchImpl,
      enabled: true,
      immediate: false,
    });
    await expect(handle.checkNow()).resolves.toBe(false);
    expect(onUpdate).not.toHaveBeenCalled();
    handle.dispose();
  });
});
