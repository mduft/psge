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

## Milestone 8 (current) — Agent development loop

**Focus:** prove an agent can ship a small game feature end-to-end (docs + verify recipe). Player loop remains M7. Do not leave throwaway shop SKUs after a proof.

**Art direction (§8.0):** Minecraft-like blocks; side cutaway shaft; half-disk surface; full-bleed HUD.

**Play (M7):** discoveries, collection / find reveal, shaft props, dirt-coin boosters, 20 special coins, FAB dig-while-open sheets, soft dig + hardness.

**Hardness:** `gained = softDigAmount(raw) × hardness(layer)` on tap, auto, offline, and short tab catch-up.

**Numbers:** Game-owned `decimal.js`; HUD idle suffixes; dig as **m/tap** and **m/s** (effective = soft × hardness).

**Testing:** `?depth=N` pre-digs when no save; `?nosave=1` clears save; `?offlineMs=N` forces offline claim; `?debug=1` tools. Stress: `?nosave=1&depth=10000`.

Engine: `createApp`, loop, camera, floating origin / chunks, SaveStore, autosave helpers, `createSeededRng`, `loadGltf`.

Dig rules, geo layers, discoveries, actors, shop, offline, and save payload live in the **game**.

**Next:** Milestone 9 Achievements → Milestone 10 3D artifact inspection (deferred).

## Agent development loop

Canonical path (see [PSGE.md](./PSGE.md) Milestone 8):

```text
modify code → assets if needed → tests → build → launch
→ interact → inspect state → screenshot → verify
```

### Verify recipe

1. `npm test` — unit tests green
2. `npm run build` — engine + game typecheck/bundle
3. `npm run dev` — open `http://localhost:5173/?nosave=1&debug=1` (or LAN host)
4. Interact (shop buy / dig); assert via console hooks or Playwright
5. `npm run test:e2e` — Chromium smoke (includes screenshot on the copper-shovel path when present)
6. Optional: Cursor built-in browser screenshot of the shop / HUD

### Runtime hooks (Endless Dig)

After `data-psge-ready="true"`:

```js
__psgeState.depth.toString()
__psgeState.upgrades
__psgeState.dirt.toString()
await __psgeSaveStore.load()
__psgeWorld.setFocusBlockY(-900)
```

Also: `__psgeApp`, `__psgeScroll`. Prefer asserting `html[data-psge-*]` and `[data-shop-buy="…"]` in e2e.

Game guide: [games/endless-dig/AGENTS.md](./games/endless-dig/AGENTS.md).

## Visual verification

- `npm run test:e2e`
- Cursor built-in browser against `npm run dev`
