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

## Milestone 4 (current)

**Art direction (§8.0):** Minecraft-like blocks; side cutaway shaft; half-disk surface; full-bleed HUD.

**M4 play:** Tap to dig; spend **Dirt** in the shop for dig-power and passive upgrades; camera follows dig face. Autosave via engine `SaveStore`. HUD: Depth / Dirt / Shop + fading Saved. World extent grows with dig (endless).

**Numbers:** Game-owned `decimal.js`; HUD idle suffixes (`K M B T` then `aa ab …`).

**Testing:** `?depth=N` pre-digs when no save; `?nosave=1` clears save. `?debug=1` = give dirt, drag-scroll (off by default), Reset. Stress: `?nosave=1&depth=10000`.

Engine: `createApp`, loop, camera, `clampDelta`, `createSeededRng`, floating origin / chunk window, `createHoldDragScroll`, `createLocalSaveStore`, `decideAutosave`.

Dig rules, shop, Decimal state, and save payload live in the **game**.

## Visual verification

- `npm run test:e2e`
- Cursor built-in browser against `npm run dev`
