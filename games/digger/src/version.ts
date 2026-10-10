/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Digger player-facing semver (distinct from save schema / milestone).
 * Source of truth: package.json `"version"`.
 */
import pkg from "../package.json";

export const GAME_VERSION: string = pkg.version;
