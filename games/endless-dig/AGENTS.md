# The Endless Dig — Agent Guide

Repo guide: [../../AGENTS.md](../../AGENTS.md). Spec: [../../PSGE.md](../../PSGE.md) (§8.0 art direction).

## Commands

From repo root: `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`.

## Milestone 1

- Full-bleed WebGL canvas + transparent HUD (title, Depth/Dirt placeholders)
- No DIG button — canvas click is the dig affordance (M2)
- Block cutaway world in `src/world.ts` + `src/blockTextures.ts`
- Camera on +Z with slight X offset
- **Drag vertically** on the canvas to scroll the camera up/down the shaft (`src/cameraScroll.ts`)

Dev hooks: `window.__psgeApp`, `window.__psgeWorld`, `window.__psgeScroll`

## World conventions

- 1 block = 1 unit; Y-up; depth along −Y
- Shaft cut open toward camera; terrain extends ±X
