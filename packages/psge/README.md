# `@psge/engine`

Pleasantly Simple Game Engine — browser helpers for small Three.js games.

**The public API is never frozen.** Prefer refactoring over preserving premature contracts.

## Surface (M1 / M1.1)

| Export | Role |
| --- | --- |
| `createApp` | Renderer, scene, camera, resize; optional lighting |
| `startLoop` / `stopLoop` | rAF loop with clamped delta |
| `loadGltf` / `setCamera` / `dispose` | Assets + camera + teardown |
| `clampDelta` / `createSeededRng` | Time + deterministic RNG |
| `createFloatingOrigin` | Logical ↔ render rebasing |
| `createChunkWindow` / `chunkIndex` | 1D chunk load window |
| `createHoldDragScroll` | Press-hold drag scroll input |

Games own art direction (lights, textures, terrain). See root [AGENTS.md](../../AGENTS.md) and [PSGE.md](../../PSGE.md).
