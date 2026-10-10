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

## Milestone 7 (current)

**Art direction (§8.0):** Minecraft-like blocks; side cutaway shaft; half-disk surface; full-bleed HUD.

**M7 play:** M6 loop plus **discoveries** — depth milestones + seeded dig rolls, collection sheet, find reveal, shaft props, and dirt-coin **boosters** (tap ×2 / auto ×1). Soft dig uses linear floor so late upgrades stay meaningful.

**Hardness:** `gained = softDigAmount(raw) × hardness(layer)` on tap, auto, offline, and short tab catch-up.

**Numbers:** Game-owned `decimal.js`; HUD idle suffixes; dig as **m/tap** and **m/s** (effective = soft × hardness).

**Testing:** `?depth=N` pre-digs when no save; `?nosave=1` clears save; `?offlineMs=N` forces offline claim; `?debug=1` tools (incl. unlock-next find). Stress: `?nosave=1&depth=10000`.

Engine: `createApp`, loop, camera, floating origin / chunks, SaveStore, autosave helpers, `createSeededRng`.

Dig rules, geo layers, discoveries, actors, shop, offline, and save payload live in the **game**.

## Visual verification

- `npm run test:e2e`
- Cursor built-in browser against `npm run dev`
