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
| `npm run dev` | Launch Endless Dig on `0.0.0.0:5173` (localhost + LAN) |
| `npm run build` | Build engine + game |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright (Chromium) |

First-time e2e: `npx playwright install chromium`

## Milestone 6 (current)

**Art direction (§8.0):** Minecraft-like blocks; side cutaway shaft; half-disk surface; full-bleed HUD.

**M6 play:** M5 loop plus **km-scale geo layers** (Topsoil → … → Abyss) with hardness, fog/sky/light mood, palette families, layer HUD + toast. Procedural digger + cart/drill/crew props in the shaft. Dig chips tint to the layer.

**Hardness:** `gained = softDigAmount(raw) × hardness(layer)` on tap, auto, offline, and short tab catch-up.

**Numbers:** Game-owned `decimal.js`; HUD idle suffixes; dig as **m/tap** and **m/s**.

**Testing:** `?depth=N` pre-digs when no save; `?nosave=1` clears save; `?offlineMs=N` forces offline claim; `?debug=1` tools. Stress: `?nosave=1&depth=10000`.

Engine: `createApp`, loop, camera, floating origin / chunks, SaveStore, autosave helpers.

Dig rules, geo layers, actors, shop, offline, and save payload live in the **game**.

## Visual verification

- `npm run test:e2e`
- Cursor built-in browser against `npm run dev`
