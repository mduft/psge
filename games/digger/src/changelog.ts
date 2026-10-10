/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Player-facing release notes for the Help → What's new tab.
 * Newest first. Update this file whenever `@psge/digger` version is bumped.
 */

export interface ChangelogEntry {
  /** Semver without leading `v`. */
  version: string;
  /** One-line headline. */
  summary: string;
  /** Short player-facing bullets. */
  highlights: readonly string[];
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: "0.9.4",
    summary: "Barrel and crate loot, What's new panel, and deep-crust iron ore.",
    highlights: [
      "Help → What's new lists release notes; tap the version label to open it",
      "Tap barrels for dirt plus a short auto-dig speed burst",
      "Tap crates for +1 on a random Per tap tool you already own",
      "Minecart clink plays when a cart is near the dig face",
      "Deep crust walls show Minecraft-style iron ore flecks",
      "Achievement and dirt toasts no longer stack on top of each other",
    ],
  },
  {
    version: "0.9.3",
    summary: "Mineshaft cart loot, décor polish, and rail achievements.",
    highlights: [
      "Tap minecarts in side shafts for a large one-shot dirt bonus",
      "Torches, crates, and filled carts along the rails",
      "Achievements for finding side tunnels and spotting carts",
      "Nosave mode skips boot find and achievement popups",
    ],
  },
  {
    version: "0.9.2",
    summary: "Side mineshaft décor, pause persistence, and UI polish.",
    highlights: [
      "Abandoned side tunnels with rails and cobwebs in the cutaway walls",
      "Auto-dig Pause preference is saved between sessions",
      "UI text selection disabled for cleaner play on touch and desktop",
    ],
  },
  {
    version: "0.9.1",
    summary: "Rename polish, audio, and update checks.",
    highlights: [
      "Game renamed to Digger with matching icons and labels",
      "Coin appear sound and mute preference",
      "Clients detect new deploys and show an update banner",
    ],
  },
];
