<!-- Copyright (c) 2026 Markus Duft. SPDX-License-Identifier: MIT -->
# The Endless Dig — Agent Guide

Repo guide: [../../AGENTS.md](../../AGENTS.md). Spec: [../../PSGE.md](../../PSGE.md) (§8.0, Milestone 8).

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

## Milestone 8 (current) — Agent loop

Process milestone: document + exercise the agent ship path. Play content is still M7.

### Agent loop (this game)

1. Change game code under `games/endless-dig/` (upgrades stay game-owned — not `@psge/engine`).
2. Add/adjust Vitest under `games/endless-dig/tests/`.
3. `npm test` then `npm run build` from repo root.
4. `npm run dev` → interact with `?nosave=1&debug=1`.
5. Inspect: `__psgeState.upgrades`, `html[data-psge-dig-power]`, `[data-shop-buy="shovel"]`.
6. `npm run test:e2e` — agent-loop test buys shovel and writes `test-results/m8-agent-loop-shop.png`.

Practice exercise: add a temporary tap upgrade end-to-end, verify, then **remove it** unless it earns a real progression niche (do not keep proof-only SKUs in the shop).

## Play (M7) reference

- Tap to dig; HUD stats (Depth / Layer / Dirt / Dirt coins / Per tap / Auto) + shop + **Finds** / **Coins** FABs
- **Discoveries** (`discoveries.ts`): depth milestones + seeded dig rolls; find-reveal modal; collection sheet; shaft props (`discoveryProps.ts`)
- **Geo layers** (`geoLayers.ts`): Topsoil 0–1k … Abyss 120k+; hardness; fog/sky/lights; layer toast
- Fine block mix (`strataAt`); digger + cart/drill/crew (`shaftActors.ts`)
- Soft dig with linear floor, then × layer hardness
- Shop: Per tap vs Auto dig; HUD shows effective m/tap / m/s; **Pause** on Auto stops live auto-dig (grab coins)
- **Offline:** ≥30s → claim at soft auto × hardness × **1/6** (max 24h); shorter hide → full-rate catch-up
- World extent grows in 256 m steps; chunk streaming + floating origin
- `?debug=1`, `?offlineMs=N`, `?depth=N`, `?nosave=1`
- **Boosters** (`boosters.ts` / `shaftCoinProps.ts`): dirt coins in the shaft (~25–50 m apart); tap ×2, auto ×1 after 6 m dig-past; HUD Dirt coins = count · dirt earned
- **Special coins** (`specialCoins.ts`): 20 unique collectibles (~220–480 m apart); hang in shaft like dirt coins (auto after 6 m); tap premium starts at 2K dirt and scales with depth; find reveal + coin collection sheet
- HUD panels (shop / finds / coins / debug) behind FABs; dig works with a panel open. Wide: dock under the right stats rail; narrow (≤520px): bottom sheets
- Save version **7** (`specialCoins.unlocked`); v2–v6 migrate

Dev hooks: `window.__psgeApp`, `__psgeWorld`, `__psgeScroll`, `__psgeState`, `__psgeSaveStore`

```js
__psgeState.depth.toString()
__psgeState.upgrades
__psgeState.discoveries.unlocked
await __psgeSaveStore.load()
__psgeWorld.setFocusBlockY(-900)
```

Useful DOM: `html[data-psge-ready]`, `data-psge-milestone`, `data-psge-dig-power`, `data-psge-dirt`, `[data-shop-buy="<id>"]`, `[data-stat="dig-power"]`.

## World conventions

- `depth` / excavated depth: positive meters down from surface (Decimal)
- Logical focus Y: `0` = surface, more negative = deeper
- Render coords stay near 0 via floating origin
- 1 block = 1 unit before `BLOCK_SCALE`
