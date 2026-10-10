/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Emits dist/version.json and bakes __PSGE_BUILD_ID__ into the client bundle.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(path.join(rootDir, "package.json"), "utf8"),
) as { version: string };

export function versionManifestPlugin(): Plugin {
  let buildId = "dev";

  return {
    name: "psge-version-manifest",
    config(_cfg, env) {
      if (env.command === "build") {
        buildId = `${pkg.version}+${Date.now().toString(36)}`;
      } else {
        buildId = "dev";
      }
      return {
        define: {
          __PSGE_BUILD_ID__: JSON.stringify(buildId),
        },
      };
    },
    generateBundle() {
      if (buildId === "dev") return;
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: `${JSON.stringify(
          { version: pkg.version, buildId },
          null,
          2,
        )}\n`,
      });
    },
  };
}
