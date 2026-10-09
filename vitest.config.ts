/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Tests import package source, not a possibly-stale dist build.
      "@psge/engine": path.resolve(__dirname, "packages/psge/src/index.ts"),
    },
  },
  test: {
    include: [
      "packages/*/tests/**/*.test.ts",
      "games/*/tests/**/*.test.ts",
    ],
  },
});
