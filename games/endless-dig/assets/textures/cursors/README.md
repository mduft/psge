<!-- Copyright (c) 2026 Markus Duft. SPDX-License-Identifier: MIT -->
# Dig tool cursors

Committed 32×32 PNGs used as the canvas cursor (hotspot = dig tip; see `digCursor.ts`).

| File | When |
| --- | --- |
| `spoon.png` | No dig-tool upgrades |
| `shovel.png` | Owned `shovel` |
| `pickaxe.png` | Owned `pickaxe` (overrides shovel) |
| `jackhammer.png` | Owned `jackhammer` (highest) |

Replace these files in place when updating art; keep size 32×32 and adjust hotspots in `src/digCursor.ts` if the tip moves.
