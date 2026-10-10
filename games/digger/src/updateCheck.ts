/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Poll `version.json` (emitted at build) for a newer deploy and prompt reload.
 */
export interface VersionManifest {
  version: string;
  buildId: string;
}

/** Default poll while the tab is visible. */
export const UPDATE_POLL_MS = 60_000;

export function parseVersionManifest(raw: unknown): VersionManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== "string" || !o.version.trim()) return null;
  if (typeof o.buildId !== "string" || !o.buildId.trim()) return null;
  return { version: o.version.trim(), buildId: o.buildId.trim() };
}

export function isNewerBuild(
  remote: VersionManifest,
  localBuildId: string,
): boolean {
  if (!localBuildId || localBuildId === "dev") return false;
  return remote.buildId !== localBuildId;
}

export function versionManifestUrl(baseUrl = import.meta.env.BASE_URL): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}version.json`;
}

export interface UpdateCheckHandle {
  dispose(): void;
  /** Force one check (tests / debug). */
  checkNow(): Promise<boolean>;
}

export interface StartUpdateCheckOptions {
  localBuildId: string;
  /** Called when a new deploy is detected. */
  onUpdateAvailable: (remote: VersionManifest) => void;
  pollMs?: number;
  fetchImpl?: typeof fetch;
  /** Skip network (dev). */
  enabled?: boolean;
  /** Run an immediate check on start (default true). */
  immediate?: boolean;
  now?: () => number;
}

/**
 * Poll for `version.json`. No-ops in dev (`localBuildId === "dev"`) unless
 * `enabled` is forced true.
 */
export function startUpdateCheck(
  options: StartUpdateCheckOptions,
): UpdateCheckHandle {
  const {
    localBuildId,
    onUpdateAvailable,
    pollMs = UPDATE_POLL_MS,
    fetchImpl = fetch,
    now = () => Date.now(),
  } = options;
  const enabled =
    options.enabled ?? (localBuildId !== "dev" && localBuildId.length > 0);
  const hasDom =
    typeof window !== "undefined" && typeof document !== "undefined";

  let timer = 0;
  let disposed = false;
  let inFlight = false;

  const checkNow = async (): Promise<boolean> => {
    if (!enabled || disposed || inFlight) return false;
    inFlight = true;
    try {
      const url = `${versionManifestUrl()}?_=${now()}`;
      const res = await fetchImpl(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return false;
      const remote = parseVersionManifest(await res.json());
      if (!remote || !isNewerBuild(remote, localBuildId)) return false;
      onUpdateAvailable(remote);
      return true;
    } catch {
      return false;
    } finally {
      inFlight = false;
    }
  };

  const schedule = (): void => {
    if (disposed || !enabled || !hasDom) return;
    if (timer !== 0) window.clearInterval(timer);
    timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkNow();
    }, pollMs);
  };

  const onVisibility = (): void => {
    if (document.visibilityState === "visible") void checkNow();
  };

  if (enabled) {
    schedule();
    if (hasDom) {
      document.addEventListener("visibilitychange", onVisibility);
    }
    if (options.immediate !== false) void checkNow();
  }

  return {
    checkNow,
    dispose(): void {
      disposed = true;
      if (timer !== 0 && hasDom) {
        window.clearInterval(timer);
        timer = 0;
      }
      if (hasDom) {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    },
  };
}
