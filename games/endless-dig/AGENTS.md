<!-- Copyright (c) 2026 Markus Duft. SPDX-License-Identifier: MIT -->
# The Endless Dig — Agent Guide

Repo guide: [../../AGENTS.md](../../AGENTS.md). Spec: [../../PSGE.md](../../PSGE.md) (§8.0, Milestone 3).

## Commands

From repo root: `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`.

Dev URL examples:

- `http://127.0.0.1:5173/` — load save if present, else dug **0**; extent ≥ `ceil(savedDepth)`
- `http://127.0.0.1:5173/?depth=100` — pre-dig to 100 only when **no** save; extent ≥ 1000
- `http://127.0.0.1:5173/?nosave=1` — clear save, fresh run
- `http://127.0.0.1:5173/?nosave=1&depth=10000` — reset + stress shaft

## Milestone 3

- Tap to dig; HUD Depth / Dirt / dig-power / Reset; camera follows dig face
- Reset: depth + dirt → 0, clears then rewrites save (keeps dig power)
- Autosave: 1s debounce, 30s max-while-dirty, flush on hide (await in-flight; re-arm on fail); fading **Saved**
- Generation extent: `max(1000, ?depth=, ceil(savedDepth))` — deep saves must not clamp to 1000 on reload
- Save key: `psge:endless-dig:save` via `createLocalSaveStore` (see `src/persist.ts`)
- Hold-drag scroll = debug only

Dev hooks: `window.__psgeApp`, `__psgeWorld`, `__psgeScroll`, `__psgeState`, `__psgeSaveStore`

```js
__psgeState.depth
await __psgeSaveStore.load()
__psgeWorld.setFocusBlockY(-900)
```

## World conventions

- `depth` / excavated depth: positive meters down from surface
- Logical focus Y: `0` = surface, more negative = deeper
- Render coords stay near 0 via floating origin
- 1 block = 1 unit before `BLOCK_SCALE`
