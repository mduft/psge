<!-- Copyright (c) 2026 Markus Duft. SPDX-License-Identifier: MIT -->
# PSGE — Agent Guide

Pleasantly Simple Game Engine monorepo. Spec: [PSGE.md](./PSGE.md).
License: [MIT](./LICENSE) — Copyright (c) 2026 Markus Duft.

## Unfrozen API

The `@psge/engine` public API is **never frozen**. Milestone exports may be renamed, split, or removed when a later milestone or a second game justifies it.

## Layout

```text
/
├── packages/psge/          → @psge/engine
└── games/endless-dig/      → sample game (The Endless Dig)
```

## Commands (repo root)

| Command | Purpose |
| --- | --- |
| `npm install` | Install workspace dependencies |
| `npm run dev` | Launch Endless Dig at http://127.0.0.1:5173 |
| `npm run build` | Build engine + game |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright (Chromium) |

First-time e2e: `npx playwright install chromium`

## Milestone 2 status

**Art direction (§8.0):** Minecraft-like blocks; side cutaway shaft; half-disk surface; full-bleed HUD.

**M2:** Tap canvas to **dig** (straight down, dig-to-reveal). Camera follows excavated depth. Hold-drag scroll is **debug** only. `?depth=N` = start pre-excavated to N for testing (omit for dug 0; stress `?depth=10000`).

Engine: `createApp`, `startLoop`, `stopLoop`, `loadGltf`, `setCamera`, `dispose`, `clampDelta`, `createSeededRng`, `createFloatingOrigin`, `createChunkWindow`, `chunkIndex`, `createHoldDragScroll`.

Dig rules live in the **game**, not the engine.

## Visual verification

- `npm run test:e2e`
- Cursor built-in browser against `npm run dev`
