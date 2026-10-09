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

## Milestone 5 (current)

**Art direction (§8.0):** Minecraft-like blocks; side cutaway shaft; half-disk surface; full-bleed HUD.

**M5 play:** M4 loop plus **offline progression**. Autosave stores `lastPlayedAtMs`. Tab hide / page close stamps leave time; on return (or reload) with auto upgrades: **≥30s** → claim modal at soft auto rate × **1/6** (max **24h**); **&lt;30s** → silent full-rate catch-up. Depth and dirt both accrue.

**Numbers:** Game-owned `decimal.js`; HUD idle suffixes (`K M B T` then `aa ab …`); dig shown as **m/tap** and **m/s**.

**Testing:** `?depth=N` pre-digs when no save; `?nosave=1` clears save; `?offlineMs=N` forces an offline window for claim UI; `?debug=1` = give dirt, drag-scroll (off by default), Reset. Stress: `?nosave=1&depth=10000`.

Engine: `createApp`, loop, camera, `clampDelta`, `createSeededRng`, floating origin / chunk window, `createHoldDragScroll`, `createLocalSaveStore`, `decideAutosave`.

Dig rules, shop, offline math, Decimal state, and save payload live in the **game**.

## Visual verification

- `npm run test:e2e`
- Cursor built-in browser against `npm run dev`
