export interface FloatingOriginOptions {
  /** Rebase when |focus - origin| exceeds this (same units as focus). */
  rebaseThreshold: number;
  /** Multiplier applied in toRender (e.g. block scale). Default 1. */
  scale?: number;
  /** Called whenever origin changes (including setOrigin). */
  onApply?: (origin: number) => void;
}

export interface FloatingOrigin {
  getOrigin(): number;
  setOrigin(origin: number): void;
  /** `(logical - origin) * scale` — keep camera/focus near zero in render space. */
  toRender(logical: number): number;
  /** Rebase to focus when drift exceeds threshold. Returns true if rebased. */
  rebaseIfNeeded(focus: number): boolean;
}

/**
 * Logical ↔ render coordinate rebasing for deep worlds.
 * Instance data stays in logical space; shift a world root via onApply.
 */
export function createFloatingOrigin(
  options: FloatingOriginOptions,
): FloatingOrigin {
  const { rebaseThreshold, scale = 1, onApply } = options;
  if (!(rebaseThreshold > 0) || !Number.isFinite(rebaseThreshold)) {
    throw new RangeError("rebaseThreshold must be a positive finite number");
  }
  if (!Number.isFinite(scale)) {
    throw new RangeError("scale must be finite");
  }

  let origin = 0;

  const apply = (): void => {
    onApply?.(origin);
  };

  return {
    getOrigin: () => origin,
    setOrigin(next: number): void {
      origin = next;
      apply();
    },
    toRender(logical: number): number {
      return (logical - origin) * scale;
    },
    rebaseIfNeeded(focus: number): boolean {
      if (Math.abs(focus - origin) <= rebaseThreshold) {
        return false;
      }
      origin = focus;
      apply();
      return true;
    },
  };
}
