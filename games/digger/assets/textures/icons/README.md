<!-- Copyright (c) 2026 Markus Duft. SPDX-License-Identifier: MIT -->
# UI / collection icons

Committed **32×32 PNGs** (transparent). Wired like dig cursors: Vite imports in
`src/icons.ts`, DOM slots use `data-icon="…"` or helpers that set `img.src`.

Replace any file **in place** with your art (keep the filename). Prefer 32×32;
larger is fine if you keep the same aspect — CSS sizes the `<img>`.

## UI (`ui/`)

| File | Used for |
| --- | --- |
| `panel-menu.png` | Narrow dock FAB (open panels) |
| `panel-close.png` | Panel / debug close |
| `tab-shop.png` | Shop tab |
| `tab-finds.png` | Finds tab |
| `tab-coins.png` | Coins tab |
| `tab-goals.png` | Goals tab |
| `debug.png` | Debug FAB |
| `auto-pause.png` | Pause auto-dig |
| `auto-play.png` | Resume auto-dig |
| `trophy.png` | Achievement unlocked toast |
| `achievement.png` | Goals list (unlocked) |
| `achievement-locked.png` | Goals list (locked) |
| `coin.png` | Special-coin list / find reveal (tinted) |
| `locked.png` | Generic locked placeholder |
| `shop-unlock.png` | Shop buy button, item not yet owned (`data-shop-action="unlock"`) |
| `shop-upgrade.png` | Shop buy button, item owned (`data-shop-action="upgrade"`) |
| `help.png` | Help FAB (opens the user manual modal) |
| `sound.png` | Mute FAB — sound on |
| `sound-mute.png` | Mute FAB — muted |

Help-manual sections also reuse these icons (via `data-icon`) so players can match HUD chrome: `tab-shop`, `tab-finds`, `tab-coins`, `tab-goals`, `panel-menu`, `coin`, `trophy`, `auto-pause`, `auto-play`, plus dig-tool `../cursors/spoon.png` as `spoon`.

## Discoveries (`discoveries/`)

Match `DiscoveryIcon` in `src/discoveries.ts`:

| File | Catalog `icon` |
| --- | --- |
| `bone.png` | `bone` |
| `shard.png` | `shard` |
| `crystal.png` | `crystal` (also source for `public/favicon.ico`) |
| `gear.png` | `gear` |
| `stone.png` | `stone` |
| `tablet.png` | `tablet` |
| `orb.png` | `orb` |

Dig-tool **cursors** stay under `../cursors/` (`src/digCursor.ts`).
