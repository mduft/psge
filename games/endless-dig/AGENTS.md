<!-- Copyright (c) 2026 Markus Duft. SPDX-License-Identifier: MIT -->
# The Endless Dig — Agent Guide

Repo guide: [../../AGENTS.md](../../AGENTS.md). Spec: [../../PSGE.md](../../PSGE.md) (§8.0, Milestone 6).

## Commands

From repo root: `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`.

Dev server listens on `0.0.0.0:5173` with `allowedHosts: true` (any hostname/IP). Use localhost, LAN IP, or the PC hostname from a phone.

Dev URL examples:

- `http://<host>:5173/` — load save if present, else dug **0**; extent ≥ `ceil(savedDepth)`
- `http://<host>:5173/?depth=100` — pre-dig to 100 only when **no** save; extent ≥ 1000
- `http://<host>:5173/?nosave=1` — clear save, fresh run
- `http://<host>:5173/?nosave=1&depth=10000` — reset + stress shaft
- `http://<host>:5173/?debug=1` — debug panel (give dirt, drag-scroll opt-in, Reset)
- `http://<host>:5173/?offlineMs=3600000` — pretend away for N ms (claim modal if auto dig owned)

## Milestone 6

- Tap to dig; HUD stats (Depth / Layer / Dirt / Per tap / Auto) + shop; camera follows dig face
- **Geo layers** (`geoLayers.ts`): Topsoil 0–1k, Packed clay 1–4k, Bedrock 4–12k, Deep crust 12–40k, Ancient 40–120k, Abyss 120k+; hardness slows dig; fog/sky/lights + palette tint; layer toast on enter
- Fine block mix (`strataAt`) still undulates inside a band; materials resolve by geo palette family
- Procedural shaft digger + tool mesh; cart / drill / crew props (`shaftActors.ts`)
- Dig/passive soft-capped then × layer hardness; chips tint to layer
- Shop: Per tap vs Auto dig; effects in **m/tap** / **m/s**
- **Offline:** ≥30s → claim at soft auto × hardness × **1/6** (max 24h); shorter hide → full-rate catch-up
- World extent grows with dig; chunk streaming + floating origin
- `?debug=1`, `?offlineMs=N`, `?depth=N`, `?nosave=1`
- Save version **4** (`lastPlayedAtMs`); v2/v3 migrate

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
