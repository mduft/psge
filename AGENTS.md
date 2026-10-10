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

## Milestone 9 (current) — Achievements

**Focus:** durable meta unlocks (toast + tabbed panel), save v10 (`panelSeen` + dirt-coin combo). Distinct from M7 discoveries (in-world finds).

**Play:** M7 loop + M8 agent-loop docs + achievements celebration chrome (no dig-power rewards).

**Hardness:** `gained = softDigAmount(raw) × hardness(layer)` on tap, auto, offline, and short tab catch-up.

**Numbers:** Game-owned `decimal.js`; HUD idle suffixes; dig as **m/tap** and **m/s** (effective = soft × hardness).

**Testing:** `?depth=N` pre-digs when no save; `?nosave=1` clears save; `?offlineMs=N` forces offline claim; `?debug=1` tools. Stress: `?nosave=1&depth=10000`.

Engine: `createApp`, loop, camera, floating origin / chunks, SaveStore, autosave helpers, `createSeededRng`, `loadGltf`.

Dig rules, geo layers, discoveries, achievements, actors, shop, offline, and save payload live in the **game**.

**Next:** Milestone 10 3D artifact inspection (deferred).

## Agent development loop (M8)

Canonical path:

```text
modify code → assets if needed → tests → build → launch
→ interact → inspect state → screenshot → verify
```

### Verify recipe

1. `npm test`
2. `npm run build`
3. `npm run dev` → `http://localhost:5173/?nosave=1&debug=1`
4. Interact; assert via `__psge*` / `data-psge-*`
5. `npm run test:e2e`

### Runtime hooks (Endless Dig)

```js
__psgeState.depth.toString()
__psgeState.upgrades
__psgeState.achievements.unlocked
await __psgeSaveStore.load()
```

Game guide: [games/endless-dig/AGENTS.md](./games/endless-dig/AGENTS.md).

## Visual verification

- `npm run test:e2e`
- Cursor built-in browser against `npm run dev`
