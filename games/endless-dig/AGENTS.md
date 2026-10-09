<!-- Copyright (c) 2026 Markus Duft. SPDX-License-Identifier: MIT -->
# The Endless Dig — Agent Guide

Repo guide: [../../AGENTS.md](../../AGENTS.md). Spec: [../../PSGE.md](../../PSGE.md) (§8.0, Milestone 4).

## Commands

From repo root: `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`.

Dev URL examples:

- `http://127.0.0.1:5173/` — load save if present, else dug **0**; extent ≥ `ceil(savedDepth)`
- `http://127.0.0.1:5173/?depth=100` — pre-dig to 100 only when **no** save; extent ≥ 1000
- `http://127.0.0.1:5173/?nosave=1` — clear save, fresh run
- `http://127.0.0.1:5173/?nosave=1&depth=10000` — reset + stress shaft
- `http://127.0.0.1:5173/?debug=1` — debug panel (dig-power override, give dirt, drag-scroll, Reset)

## Milestone 4

- Tap to dig; HUD Depth / Dirt / Shop; camera follows dig face
- Shop: spend dirt on shovel / pickaxe / jackhammer (dig power) and cart / drill / crew (depth/s)
- Dig power derived from upgrades (base `1/32`; shovel `+1/32` so first buy doubles)
- Passive dig via `startLoop`; Decimal depth/dirt; idle `formatAmount` (`2.1K`, `2.1aa`, …)
- World extent **grows** with dig (not capped at 1000); chunk streaming + floating origin
- `?debug=1`: dig-power slider, give-dirt buttons, drag-scroll toggle, Reset (clears save)
- Autosave: 1s debounce, 30s max-while-dirty, flush on hide; fading **Saved**
- Save key: `psge:endless-dig:save` via `createLocalSaveStore` (version **3**; v2 migrates)

Dev hooks: `window.__psgeApp`, `__psgeWorld`, `__psgeScroll`, `__psgeState`, `__psgeSaveStore`

```js
__psgeState.depth.toString()
await __psgeSaveStore.load()
__psgeWorld.setFocusBlockY(-900)
```

## World conventions

- `depth` / excavated depth: positive meters down from surface (Decimal)
- Logical focus Y: `0` = surface, more negative = deeper
- Render coords stay near 0 via floating origin
- 1 block = 1 unit before `BLOCK_SCALE`
