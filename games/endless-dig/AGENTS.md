<!-- Copyright (c) 2026 Markus Duft. SPDX-License-Identifier: MIT -->
# The Endless Dig — Agent Guide

Repo guide: [../../AGENTS.md](../../AGENTS.md). Spec: [../../PSGE.md](../../PSGE.md) (§8.0, Milestone 1.1).

## Commands

From repo root: `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`.

Dev URL examples:

- `http://127.0.0.1:5173/` — shaft depth **1000** (default)
- `http://127.0.0.1:5173/?depth=10000` — stress scroll

## Milestone 1.1

- Full-bleed canvas + HUD (Shaft / View / Chunk / Logical Y / Origin Y / Engine Y / Loaded)
- Drag vertically to scroll (`src/cameraScroll.ts`)
- Terrain / cutaway content in `src/world.ts`; streaming + origin via `@psge/engine`
- 2×2 cutaway shaft; half-disk surface near the top only; Dig owns lighting/camera framing

Dev hooks: `window.__psgeApp`, `window.__psgeWorld`, `window.__psgeScroll`

Useful:

```js
__psgeWorld.setFocusBlockY(-900)
__psgeWorld.getLoadedChunkCount()
__psgeWorld.getOriginBlockY()
```

## World conventions

- Logical focus in **block units** (0 = surface, negative = down)
- Render coords stay near 0 via origin rebase
- 1 block = 1 unit before `BLOCK_SCALE`
