<!-- Copyright (c) 2026 Markus Duft. SPDX-License-Identifier: MIT -->
# Digger — Agent Guide

Repo guide: [../../AGENTS.md](../../AGENTS.md). Spec: [../../PSGE.md](../../PSGE.md) (§8.0, Milestone 9).

## Commands

From repo root: `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`.

Dev server listens on `0.0.0.0:5173` with `allowedHosts: true` (any hostname/IP). Use localhost, LAN IP, or the PC hostname from a phone.

Dev URL examples:

- `http://<host>:5173/` — load save if present, else dug **0**; extent ≥ `ceil(savedDepth)`
- `http://<host>:5173/?depth=100` — pre-dig to 100 only when **no** save; extent ≥ 1000
- `http://<host>:5173/?nosave=1` — clear save, fresh run; skips boot find/achievement popups
- `http://<host>:5173/?nosave=1&depth=10000` — reset + stress shaft (no boot modals)
- `http://<host>:5173/?debug=1` — debug panel (give dirt, layer jumps, unlock find, drag-scroll opt-in, Reset)
- `http://<host>:5173/?offlineMs=3600000` — pretend away for N ms (claim modal if auto dig owned)

## Milestone 9 (current) — Achievements

- Catalog + evaluate: `achievements.ts` (toast-only; no dig-power rewards) — depth 10 m … 10 000 km, geo layers, tool/auto ownership, per-upgrade Lv 10, any Lv 25/50, 100 total levels, dirt, finds, AFK/offline, first mineshaft, 3/10 minecarts seen
- Save version **11** (`autoDigPaused` + mineshaft cart claim/seen ids); v2–v10 migrate
- Unreadable saves: modal with **Reload** (keep blob, refresh) or **Reset progress** (clear, then boot); `html[data-psge-save-error]` while open
- Tab dots (not counts) for unseen unlocks; opening the tab clears the dot
- FAB **Achievements** sheet + toast queue; distinct from Finds (discoveries) / Coins (special coins)
- Hooks: `__psgeState.achievements`, `html[data-psge-achievements-count]`, `[data-achievement="first-dig"]`

## Play reference (M7+)

- Tap to dig; HUD stats + shop + **Finds** / **Coins** / **Achievements** FABs
- **Discoveries** (`discoveries.ts`): depth milestones + seeded dig rolls; find-reveal modal; collection sheet
- **Geo layers** (`geoLayers.ts`): Topsoil 0–1k … Abyss 120k+; hardness; fog/sky/lights; layer toast
- Soft dig with linear floor, then × layer hardness
- Shop: Per tap vs Auto dig; **Pause** on Auto (persisted in save)
- **Offline:** ≥30s → claim at soft auto × hardness × **1/6** (max 24h)
- **Boosters** / **Special coins** in the shaft (6 m auto grace); dirt-coin tap = depth×combo (`BOOSTER_TAP_*` / `BOOSTER_COMBO_*` in `boosters.ts`), auto ×1
- **Side mineshafts** (`mineshafts.ts` + `mineshaftProps.ts`): abandoned tunnels in the cutaway walls (rails, cobwebs, torches, crates). Occasional **minecarts** on the rails — **tap a cart** for a large one-shot dirt bonus (toast; empty carts stay empty). First filled cart ~1642 m; coal fill ≥4 km. Reward: `mineshaftCartDirtReward` (≥1k, scales with depth)
- HUD panels dig-while-open (wide: right dock; narrow ≤520px: bottom sheets)

Dev hooks: `window.__psgeApp`, `__psgeWorld`, `__psgeScroll`, `__psgeState`, `__psgeSaveStore`

```js
__psgeState.depth.toString()
__psgeState.achievements.unlocked
__psgeState.discoveries.unlocked
await __psgeSaveStore.load()
```

Useful DOM: `html[data-psge-ready]`, `data-psge-milestone`, `data-psge-version` (game semver from `package.json`), `data-psge-help` (manual modal), `data-psge-dig-power`, `data-psge-achievements-count`, `[data-shop-buy="<id>"]` (icon-only; `data-shop-action="unlock|upgrade"`).

Help: `#help-fab` opens a full-screen how-to-play modal (`#help-backdrop`).
Mute: `#mute-fab` above help; preference in `localStorage` key `psge:digger:muted` (`html[data-psge-muted]`). Coin appear SFX: `assets/audio/coin.wav`.

Game version: bump `@psge/digger` `package.json` `"version"` (shown as `v…` under the title).
Deploy updates: production builds emit `dist/version.json` (`buildId`); clients poll and show `#update-banner` (`html[data-psge-update]`) when it changes.

## Art replace slots

- Dig cursors: `assets/textures/cursors/` → `src/digCursor.ts`
- HUD / collection icons: `assets/textures/icons/` → `src/icons.ts` (`img[data-icon]`, discovery/`coin`/`achievement` helpers)
- SFX: `assets/audio/` → `src/audio.ts`
- Swap PNGs in place; see each folder’s README.

## World conventions

- `depth` / excavated depth: positive meters down from surface (Decimal)
- Logical focus Y: `0` = surface, more negative = deeper
- Render coords stay near 0 via floating origin
- 1 block = 1 unit before `BLOCK_SCALE`
- Side mineshafts: `mineshafts.ts` carves air from cutaway walls; rails / cobwebs / torches / crates / minecarts in `mineshaftProps.ts` (pick via `world.pickMinecart`)
