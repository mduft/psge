<!-- Copyright (c) 2026 Markus Duft. SPDX-License-Identifier: MIT -->
# The Endless Dig — Agent Guide

Repo guide: [../../AGENTS.md](../../AGENTS.md). Spec: [../../PSGE.md](../../PSGE.md) (§8.0, Milestone 9).

## Commands

From repo root: `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`.

Dev server listens on `0.0.0.0:5173` with `allowedHosts: true` (any hostname/IP). Use localhost, LAN IP, or the PC hostname from a phone.

Dev URL examples:

- `http://<host>:5173/` — load save if present, else dug **0**; extent ≥ `ceil(savedDepth)`
- `http://<host>:5173/?depth=100` — pre-dig to 100 only when **no** save; extent ≥ 1000
- `http://<host>:5173/?nosave=1` — clear save, fresh run
- `http://<host>:5173/?nosave=1&depth=10000` — reset + stress shaft
- `http://<host>:5173/?debug=1` — debug panel (give dirt, layer jumps, unlock find, drag-scroll opt-in, Reset)
- `http://<host>:5173/?offlineMs=3600000` — pretend away for N ms (claim modal if auto dig owned)

## Milestone 9 (current) — Achievements

- Catalog + evaluate: `achievements.ts` (toast-only; no dig-power rewards)
- Save version **9** (`panelSeen` for Finds/Coins/Goals new-dots); v2–v8 migrate
- Tab dots (not counts) for unseen unlocks; opening the tab clears the dot
- FAB **Achievements** sheet + toast queue; distinct from Finds (discoveries) / Coins (special coins)
- Hooks: `__psgeState.achievements`, `html[data-psge-achievements-count]`, `[data-achievement="first-dig"]`

## Play reference (M7+)

- Tap to dig; HUD stats + shop + **Finds** / **Coins** / **Achievements** FABs
- **Discoveries** (`discoveries.ts`): depth milestones + seeded dig rolls; find-reveal modal; collection sheet; shaft props
- **Geo layers** (`geoLayers.ts`): Topsoil 0–1k … Abyss 120k+; hardness; fog/sky/lights; layer toast
- Soft dig with linear floor, then × layer hardness
- Shop: Per tap vs Auto dig; **Pause** on Auto
- **Offline:** ≥30s → claim at soft auto × hardness × **1/6** (max 24h)
- **Boosters** / **Special coins** in the shaft (6 m auto grace)
- HUD panels dig-while-open (wide: right dock; narrow ≤520px: bottom sheets)

Dev hooks: `window.__psgeApp`, `__psgeWorld`, `__psgeScroll`, `__psgeState`, `__psgeSaveStore`

```js
__psgeState.depth.toString()
__psgeState.achievements.unlocked
__psgeState.discoveries.unlocked
await __psgeSaveStore.load()
```

Useful DOM: `html[data-psge-ready]`, `data-psge-milestone`, `data-psge-dig-power`, `data-psge-achievements-count`, `[data-shop-buy="<id>"]` (icon-only; `data-shop-action="unlock|upgrade"`).

## Art replace slots

- Dig cursors: `assets/textures/cursors/` → `src/digCursor.ts`
- HUD / collection icons: `assets/textures/icons/` → `src/icons.ts` (`img[data-icon]`, discovery/`coin`/`achievement` helpers)
- Swap PNGs in place; see each folder’s README.

## World conventions

- `depth` / excavated depth: positive meters down from surface (Decimal)
- Logical focus Y: `0` = surface, more negative = deeper
- Render coords stay near 0 via floating origin
- 1 block = 1 unit before `BLOCK_SCALE`
