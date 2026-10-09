<!-- Copyright (c) 2026 Markus Duft. SPDX-License-Identifier: MIT -->
# The Endless Dig — Agent Guide

Repo guide: [../../AGENTS.md](../../AGENTS.md). Spec: [../../PSGE.md](../../PSGE.md) (§8.0, Milestone 2).

## Commands

From repo root: `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`.

Dev URL examples:

- `http://127.0.0.1:5173/` — normal play (dug **0**, world extent **1000**)
- `http://127.0.0.1:5173/?depth=100` — testing: start already dug to **100** m (extent at least 1000)
- `http://127.0.0.1:5173/?depth=10000` — stress: pre-open shaft + generate to **10000**

## Milestone 2

- Tap canvas to dig; HUD: **Depth**, **Dirt**, dig-power slider; camera follows dig face
- Hold-drag scroll = debug/testing only
- Dig-to-reveal cavity in `src/world.ts` (`excavatedDepth` vs `worldExtent`)
- `?depth=N` pre-excavates to N for testing (omit for normal play)
- State: `src/gameState.ts` — `createInitialState`, `dig`
- Dig power slider: 1…256 steps of `1/32` block (default 1 = ~one screen pixel)

Dev hooks: `window.__psgeApp`, `window.__psgeWorld`, `window.__psgeScroll`, `window.__psgeState`

Useful:

```js
__psgeState.depth
__psgeWorld.setExcavatedDepth(12)
__psgeWorld.setFocusBlockY(-900) // debug scroll within worldExtent
__psgeWorld.getLoadedChunkCount()
```

## World conventions

- `depth` / excavated depth: positive meters down from surface
- Logical focus Y: `0` = surface, more negative = deeper
- `?depth=N` = start pre-excavated to N (testing); world extent is at least `max(N, 1000)`
- Render coords stay near 0 via floating origin
- 1 block = 1 unit before `BLOCK_SCALE`
