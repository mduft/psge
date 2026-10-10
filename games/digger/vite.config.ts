/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { versionManifestPlugin } from "./vite.versionPlugin.js";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: ".",
  publicDir: "public",
  plugins: [versionManifestPlugin()],
  resolve: {
    alias: {
      "@psge/engine": path.resolve(rootDir, "../../packages/psge/src/index.ts"),
    },
  },
  server: {
    // All interfaces so LAN devices (e.g. phone) can hit the machine's IP.
    // Playwright still forces 127.0.0.1 via CLI flags in playwright.config.ts.
    host: "0.0.0.0",
    port: 5173,
    // Allow any Host header (hostname / .local / router suffix). Dev-only.
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
