# PSGE — Agent Guide

Pleasantly Simple Game Engine monorepo. Spec: [PSGE.md](./PSGE.md).

## Unfrozen API

The `@psge/engine` public API is **never frozen**. Milestone exports may be renamed, split, or removed when a later milestone or a second game justifies it.

## Layout

```text
/
├── packages/psge/          → @psge/engine
└── games/endless-dig/      → sample game (The Endless Dig)
```

## Commands (repo root)

| Command | Purpose |
| --- | --- |
| `npm install` | Install workspace dependencies |
| `npm run dev` | Launch Endless Dig at http://127.0.0.1:5173 |
| `npm run build` | Build engine + game |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright (Chromium) |

First-time e2e: `npx playwright install chromium`

## Milestone 1 status

**Art direction (§8.0):** Minecraft-like blocks; side cutaway shaft; surface extends left/right; full-bleed canvas + HUD overlays; dig = canvas click (wired in M2).

Engine: `createApp`, `startLoop`, `loadGltf`, `setCamera`, `dispose`, `clampDelta`, `createSeededRng`.

## Visual verification

- `npm run test:e2e`
- Cursor built-in browser against `npm run dev`
