<!-- Copyright (c) 2026 Markus Duft. SPDX-License-Identifier: MIT -->
# Pleasantly Simple Game Engine (PSGE)

> Working project and architecture specification
> Status: Milestone 0–7 implemented — decisions locked in §4.8; API unfrozen (§28)
> Core goal: make small browser games **pleasantly simple to build, test, run, and evolve — including by autonomous agents**.

---

# 1. Project

## 1.1 Goal

The goal is to develop a reusable game engine for browser-based games.

The initial target games are intentionally small in scope:

- Incremental games such as Cookie Clicker or Tap Titans.
- Games with a very simple, highly repetitive game loop, such as searching through a very large number of objects until a specific object is found.
- Simple 3D puzzle games in which the player interacts with a floating 3D object and discovers specific features or objects to unlock the next level.

Games should primarily operate locally in the browser. Networking with a server backend should nevertheless be possible to integrate later.

The long-term product goal is a website offering many individual games, with advertising as the primary monetization mechanism.

---

# 2. Core Philosophy: Pleasantly Simple

The defining property of PSGE is not a particular rendering technology or feature list.

It is **simplicity**.

> **PSGE should make small browser games easy to build, test, run, and publish.**

PSGE is not intended to become a general-purpose game engine or compete with Unity, Unreal, Godot, or similar products.

The engine should have:

- fewer concepts;
- fewer abstractions;
- less ceremony;
- a small public API;
- strong use of existing browser capabilities;
- strong use of proven third-party technology.

Whenever the browser or an established library already provides a good solution, PSGE should generally use it rather than reimplement it.

A core rule is:

> **Prefer ordinary TypeScript, HTML, CSS, browser APIs, and proven libraries over PSGE-specific abstractions.**

An abstraction belongs in PSGE when it removes repetitive or difficult work for the target games. It should not exist merely because traditional game engines contain such a concept.

---

# 3. Agent-Native Development

A major requirement of PSGE is that the entire system should be suitable for development by software agents.

This applies to **everything**, not just the TypeScript game logic.

The desired future workflow is that an agent can receive a request such as:

> Add a copper shovel that increases digging power by 25%, create any required visual assets, add tests, and make the game visually communicate the new equipment.

The agent should be able to:

```text
Understand project
      ↓
Inspect game state / architecture
      ↓
Modify source code
      ↓
Create or modify assets
      ↓
Build
      ↓
Run automated tests
      ↓
Launch browser game
      ↓
Interact with game
      ↓
Inspect state / diagnostics
      ↓
Capture screenshots
      ↓
Visually verify result
      ↓
Iterate
```

Agentability is therefore an architectural requirement rather than a later tooling feature.

## 3.1 Agent-friendly source code

Game code should use normal, explicit TypeScript.

Prefer:

```ts
function dig(state: GameState): void {
    state.progress += state.digPower;
}
```

over opaque frameworks that hide game behavior behind generated code, visual graphs, decorators, or extensive configuration.

An agent should be able to understand most game behavior by reading ordinary source files.

## 3.2 Agent-friendly project structure

The repository is an **npm workspaces monorepo** with a predictable, shallow layout:

```text
/
├── package.json              # npm workspaces root
├── AGENTS.md                 # repo-wide agent guide
├── PSGE.md
├── packages/
│   └── psge/                 # @psge/engine
│       ├── package.json
│       ├── src/
│       └── tests/
└── games/
    └── endless-dig/
        ├── game.json
        ├── package.json
        ├── AGENTS.md         # game-specific
        ├── src/
        ├── assets/
        │   ├── models/
        │   ├── textures/
        │   ├── audio/
        │   └── data/
        ├── tests/
        └── public/
```

Root scripts (documented in `AGENTS.md`): `dev` (endless-dig), `build`, `test`, `test:e2e`.

Important properties: predictable, discoverable, convention-driven, easy to search, and easy for agents to modify safely.

## 3.3 Machine-readable project metadata

Each game should expose basic metadata in `game.json`. For Milestone 0/1 the schema is intentionally minimal:

```json
{
  "id": "endless-dig",
  "name": "The Endless Dig",
  "engine": "psge",
  "entry": "src/game.ts"
}
```

A richer `game.json` can be introduced when useful.

## 3.4 AGENTS.md

The repo root and each game should contain an `AGENTS.md` describing:

- project conventions;
- architecture;
- important commands (`dev`, `build`, `test`, `test:e2e`);
- asset workflow;
- visual verification workflow;
- known constraints.

This should be plain Markdown and easy for any capable agent to understand.

## 3.5 Deterministic execution

Whenever practical, game behavior should be deterministic.

The following should be controllable in tests and agent runs:

- random number generation;
- game time;
- offline elapsed time;
- input;
- save/load;
- network responses.

This makes debugging and automated development substantially easier.

## 3.6 Programmatic game actions

Anything a human can do in the game should have a corresponding programmatic representation where practical.

For example:

```ts
game.dig();
game.buyUpgrade("steel-shovel");
game.inspectDiscovery("ancient-bone");
```

The browser UI then invokes the same underlying operations.

Browser interaction is still necessary for testing presentation and real integration, but game behavior should not require it.

## 3.7 Inspectable runtime state

A running game should provide a safe inspection/debug mechanism.

For example:

```text
game state
current depth
resource amounts
upgrade levels
active discoveries
player progress
```

The exact mechanism may be a development-only API or other machine-readable endpoint.

The principle is:

> **An agent should be able to answer "what is the game state right now?" without reverse-engineering the DOM or canvas.**

## 3.8 Browser automation and visual verification

PSGE development should support automated browser testing.

A suitable browser automation framework should eventually allow agents to:

- launch the game;
- click/tap controls;
- manipulate the game;
- inspect the page;
- inspect console errors;
- capture screenshots;
- verify visible UI.

Browser automation uses **Playwright** (Chromium for automated e2e). Visual checks may also use the Cursor built-in browser.

Visual verification is important because a game can be logically correct while still being visually broken.

---

# 4. Technology Strategy

PSGE should use proven fundamental technology wherever practical.

The project should avoid implementing infrastructure merely for the sake of owning it.

## 4.1 TypeScript

TypeScript should be the primary language.

Reasons:

- strong tooling;
- static typing;
- excellent browser support;
- easy testing;
- familiar development model;
- directly usable for both engine and game code;
- highly suitable for agent-generated code.

PSGE should not invent a custom game scripting language.

## 4.2 Browser technologies

PSGE should embrace the browser rather than hide it completely.

Likely foundations:

- HTML for structure;
- CSS for UI and layout;
- Canvas 2D for simple 2D rendering;
- WebGL 2 through an established 3D library;
- `requestAnimationFrame()` for the main loop;
- browser storage for local persistence.

## 4.3 3D: use an established library

PSGE should not initially implement a 3D renderer directly on top of WebGL.

The proposed underlying 3D technology is **Three.js**.

Conceptually:

```text
Game
  ↓
PSGE 3D API
  ↓
Three.js
  ↓
WebGL
  ↓
Browser / GPU
```

Three.js provides the complicated rendering machinery.

PSGE should provide the simpler game-oriented layer.

This allows the project to concentrate on:

- game lifecycle;
- game state;
- persistence;
- input;
- testing;
- asset conventions;
- agentability;
- simple 2.5D/3D game APIs.

PSGE should not reinvent shader management, buffers, cameras, materials, scene internals, loaders, and rendering infrastructure unless a real requirement eventually justifies it.

## 4.4 2D: use the simplest suitable technology

For simple 2D games, native Canvas 2D should be the default candidate.

A dedicated 2D library should only be added when an actual target game demonstrates the need.

## 4.5 3D assets: glTF / GLB

The proposed runtime 3D asset format is **glTF 2.0**, preferably `.glb`.

This gives PSGE a standardized runtime representation for meshes, materials, textures, scenes, transforms, and animations.

PSGE should not invent its own runtime model format.

## 4.6 Source assets versus runtime assets

Agent-friendly development requires more than having loadable runtime assets.

For important generated or authored assets, the project should preferably retain:

```text
Source / recipe
      ↓
Generation or conversion step
      ↓
Runtime asset
```

For example:

```text
artifact.blend
artifact.glb
artifact-preview.png
artifact.metadata.json
```

or, for generated textures:

```text
texture prompt / source
texture source data
texture.png
texture.metadata.json
```

The exact asset workflow will depend on the tools eventually chosen.

The guiding principle is:

> **An agent should be able to determine where an asset came from, reproduce it where practical, and modify or replace it without manually reverse-engineering a binary file.**

## 4.7 Existing tools over custom tools

The same principle applies to modeling, texture creation, image processing, audio, compression, browser automation, testing, and packaging.

PSGE should orchestrate proven tools rather than duplicate them.

## 4.8 Resolved decisions for Milestone 0 / 1 / 1.1 / 2 / 3 / 4 / 5 / 6 / 7

The following choices are locked for implementing these milestones. They may still change later; see the unfrozen-API policy in §28.

| Topic | Decision |
| --- | --- |
| Layout | npm workspaces monorepo: `packages/psge` + `games/endless-dig` |
| Engine package | `@psge/engine` |
| Package manager | npm |
| Bundler / app host | Vite |
| Unit tests | Vitest |
| Browser / e2e tests | Playwright (Chromium) |
| Browser support | No hardcoded support matrix; automate against Chromium; visual checks also via the Cursor built-in browser |
| `game.json` | `{ id, name, engine, entry }` only for M0/M1 |
| Asset directories | `assets/models`, `textures`, `audio`, `data` — conventions in `AGENTS.md`; no metadata schema until an asset needs one |
| M1 art direction | Minecraft-like **block / voxel** look (see §8.0) |
| M1 presentation | Side-view **cutaway shaft**; surface extends left/right; camera ready to scroll down the shaft |
| M1 shell UI | Full-bleed canvas (no window-in-window); transparent HUD overlays; dig = click canvas (no dedicated DIG button) |
| Responsive | Usable on phone, tablet, desktop, and half-desktop split layouts |
| Deep scroll (M1.1) | Vertical **chunk streaming** + **floating origin** rebasing |
| `?depth=N` (testing) | Pre-excavate to N when there is **no** save (or after `nosave`); generation extent `max(1000, N, ceil(savedDepth))` |
| M2 dig | Straight-down only; **dig-to-reveal** cavity = excavated `depth`; camera **follows** dig face |
| M2 input | Tap (no drag) digs; hold-drag scroll is **debug/testing** only for now |
| M2 state | Plain game-owned `GameState` `{ version, depth, dirt, digPower }`; engine has no dig rules |
| M3 SaveStore | Engine `SaveStore` + `createLocalSaveStore`; game never touches `localStorage` directly |
| M3 autosave | Debounce **1s** after change; force save at least every **30s** while dirty; flush on pagehide/hidden |
| M3 testing | `?nosave=1` **clears** save and starts fresh (`?depth=` then applies); deep saves expand extent on reload |
| M4 resource | **Dirt** is the spendable currency (`depthGained × 4` still) |
| M4 shop | Tiny HUD shop: spend dirt on level-based upgrades |
| M4 dig power | Derived from upgrades (base `1/32`; shovel `+1/32`); `?debug=1` = give-dirt / Reset / drag-scroll (off by default) |
| M4 passive | Auto-dig depth/sec from generator upgrades; applied each frame via `startLoop(update)` |
| M4 numbers | Game-owned `decimal.js` for depth/dirt/costs/rates; persist as strings; HUD idle suffixes `K M B T` then `aa ab …` |
| M4 save | `GameState` version **3**; migrate v2 → Decimals + empty upgrades (slider digPower discarded) |
| M4 endless | Generation extent **grows** with excavated depth (+ lookahead); 1000 is initial look-ahead, not an end |
| M5 offline | Depth **and** dirt; soft-capped live auto × hardness × **1/6**; max **24h**; claim modal when away ≥**30s** (tab hide or unload); shorter hides get full-rate catch-up |
| M5 clock | Persist `lastPlayedAtMs` (save version **4**; v2/v3 migrate with clock `0`); pure `computeOfflineReward(state, last, now)` |
| M5 testing | Injectable `nowMs` in unit tests; `?offlineMs=N` forces an offline window in the browser |
| M6 geo layers | km-scale named bands (Topsoil→Abyss); hardness after soft-cap; HUD label + enter toast |
| M6 mood | Fog/sky/lights + palette-family tints + layer chip colors |
| M6 actors | Procedural digger (tool swap) + cart/drill/crew props; no camera polish |
| M7 discoveries | Depth milestones + seeded dig rolls; collection + find-reveal sheets; shaft props; dirt-coin boosters; 20 special coins |
| M7 save | `GameState` version **7** (`discoveries` + dirt-coin boosters + special coins); v2–v6 migrate |
| M9 achievements | Toast + FAB sheet; pure evaluate; save version **8**; v2–v7 migrate |

> **The public PSGE API is never frozen.** A second sample game may require refactoring `@psge/engine`. That cost is accepted; do not treat early exports as permanent contracts.

---

# 5. Architectural Principles

## 5.1 Game logic is independent from rendering

Game state and rules should not depend directly on WebGL, DOM elements, or browser-specific rendering details.

Conceptually:

```text
Game State
    ↓
Game Logic
    ↓
Presentation
    ↓
Browser
```

The same game logic should be executable in automated tests without requiring the renderer.

## 5.2 Game state is ordinary data

Game state should preferably be plain TypeScript data.

Example:

```ts
interface GameState {
    depth: number;
    dirt: number;
    digPower: number;
}
```

State should be:

- inspectable;
- serializable;
- testable;
- versionable;
- independent of rendering;
- independent of DOM structure.

## 5.3 Local-first persistence

The initial persistence implementation should use browser-local storage.

Persistence should be exposed behind a small interface:

```text
Game
  ↓
SaveStore
  ├── LocalSaveStore
  └── ServerSaveStore (future)
```

The game should never directly depend on `localStorage`.

## 5.4 No hidden global state

Dependencies should be explicit.

A small engine context is preferable to a service container or dependency-injection framework.

Conceptually:

```ts
interface EngineContext {
    time: Time;
    input: Input;
    assets: Assets;
    storage: SaveStore;
    renderer: Renderer;
}
```

## 5.5 No premature abstractions

PSGE should evolve from actual game requirements.

> **Build the smallest engine abstraction required by an actual game, test it, and generalize it only when another real use case justifies doing so.**

This applies especially to ECS, event buses, scene systems, prefab systems, dependency injection, physics, complex resource pipelines, and plugin systems.

---

# 6. The Endless Dig — Sample Game

## 6.1 Concept

The first sample game should be an incremental excavation game.

Working title:

> **The Endless Dig**

The player operates an excavation that begins as a simple manual digging operation and eventually becomes a completely absurd industrial-scale excavation.

The basic fantasy is:

> **Something is down there. Keep digging until you find it.**

The numbers can become ridiculous while the underlying progression remains simple and effectively linear.

The sample game should be simple enough to fully understand, but rich enough to exercise nearly every important PSGE feature.

---

# 7. Core Gameplay Loop

The primary loop is:

```text
DIG
  ↓
remove material
  ↓
progress deeper
  ↓
earn resources / findings
  ↓
buy better equipment
  ↓
dig faster
  ↓
reach new geological layers
  ↓
discover something
  ↓
investigate it
  ↓
continue digging
```

The player is not controlling a character in a conventional game world.

The player is operating an excavation.

## 7.1 Dig visual pace

Early digging should feel tiny: with the initial gear, each dig advances the excavation by roughly **a pixel** on screen. As equipment and production improve, visible descent should speed up **slowly**, until late-game motion looks and feels very fast.

Endless Dig: nominal dig power / passive rate (sum of upgrades) is applied through `softDigAmount` in `softDig.ts` — `floor·raw + (1−floor)·s·asinh(raw/s)` (`SOFT_DIG_SCALE` 3, `SOFT_DIG_LINEAR_FLOOR` 0.25) — so early taps stay nearly full strength, high stacks bend below linear, and each upgrade still contributes at least ~25% of its nominal amount. **Current depth does not affect dig speed** beyond geo-layer hardness (M6); only instantaneous power/rate feeds the soft map. Shaft and camera follow the resulting depth 1:1. Pickaxe / jackhammer per-level steps are `+2/32` / `+8/32`.

---

# 8. Visual Presentation

The game should use a **2.5D / fixed-camera 3D presentation from the beginning**.

This is an intentional design choice, not something to add after a 2D prototype.

The world itself is genuinely 3D.

The camera simply removes unnecessary movement from the player's responsibilities.

## 8.0 Art direction — block cutaway (locked)

Endless Dig presentation constraints (Milestone 1+):

1. **Minecraft-like blocks.** The world is built from unit cubes with a chunky voxel look. Digging later removes layers/blocks rather than morphing a smooth mesh hole.
2. **Side-view cutaway shaft.** The shaft is cut open toward the camera so the player reads depth as a vertical cross-section. The surface **extends left and right**. As the game progresses, the view **scrolls down** the shaft (camera follows depth; orientation stays locked).
3. **Integrated shell.** The WebGL canvas is full-bleed in the browser viewport — not a framed “window inside a window”. Stats and title are **transparent HUD overlays** on top of the scene. Primary dig action is **clicking the canvas** (no separate DIG button chrome).
4. **Responsive.** The game must be usable on phone, tablet, full desktop, and half-desktop (side-by-side windows). Exact pixel-perfect scaling animation is not required; layout and camera framing must remain readable.

## 8.1 Fixed-camera excavation diorama

The primary game scene is a side-view cross-section of the excavation.

The camera is perspective-based and permanently locked.

The player cannot freely rotate or move the camera.

The scene behaves like a 3D block diorama viewed through a fixed (but full-bleed) frame.

Conceptually:

```text
                 SKY

    🌳🌳    🏠🏠🏠     🌳
   ███████████████████████   ← surface extends sideways
   ████   ░░░░░░░   ████
   ████   ░░░░░░░   ████     ← shaft cut open toward camera
   ████   ░░░░░░░   ████
   ████   ░░░░░░░   ████
   ███████████████████████
            ▼ deeper
```

The camera looks at the underground cross-section from the side (+Z).

The visual orientation should remain stable: the tunnel goes **straight down on screen** rather than diagonally or with a skewed perspective that changes the apparent direction of the shaft.

The world can still use perspective depth for 3D block faces, lighting, and parallax; the camera orientation and the excavation's vertical axis remain fixed and easy to understand.

## 8.2 Surface scene

The upper portion of the scene should initially be a pleasant 3D landscape.

Possible elements:

- grass;
- trees;
- shrubs;
- flowers;
- a small house;
- garden;
- fence;
- shed;
- driveway;
- harmless environmental details.

The surface should feel like a small, attractive diorama.

It provides a strong visual contrast with the increasingly strange underground world.

## 8.3 The tunnel

The tunnel is a straight vertical excavation descending from the surface.

The player should visually perceive depth primarily through:

- geological layers;
- tunnel walls;
- lighting;
- shadows;
- machinery;
- particles;
- discoveries;
- scale changes.

The tunnel does not wander sideways.

It remains visually understandable even after the depth becomes enormous.

## 8.4 Player position and camera movement

The player should always be visually located approximately in the middle of the screen, while the camera follows the excavation downward.

The player therefore experiences the feeling of descending while the world scrolls around the player rather than requiring the player to control a character camera.

Conceptually:

```text
Depth 10 m

surface
────────────────
      ↓ focus / player
      ███
      ███
      ███


Depth 100 m

surface is now above the viewport
────────────────
      ↓ focus / player
      ███
      ███
      ███


Depth 1,000 m

previous layers are far above
────────────────
      ↓ focus / player
      ███
      ███
      ███
```

The exact player representation may evolve. The important visual rule is that **depth moves vertically through the scene while the camera keeps the current excavation area near the center of the viewport**.

Camera movement should be smooth enough to communicate continuous descent, but it should not require any player camera control.

## 8.5 No first-person controls

The game should deliberately avoid first-person interaction.

There is no requirement for:

- pointer lock;
- mouse capture;
- WASD movement;
- free camera rotation;
- FPS collision;
- player locomotion.

Normal browser interaction should be sufficient:

- mouse click;
- touch;
- dragging where useful;
- ordinary buttons.

This keeps the game comfortable in a browser and substantially improves agentability.

---

# 9. Why 2.5D From the Start

The fixed-camera 2.5D approach has several benefits.

### Simplicity

The player only needs to understand one visual relationship:

> the excavation goes down.

### Browser suitability

No pointer lock or complex mouse handling is required.

### Visual richness

The game is still a real 3D scene with lighting, models, textures, shadows, animation, and depth.

### Natural transition to 3D puzzles

Artifacts discovered underground can later open into proper 3D inspection scenes.

The game therefore establishes its 3D rendering technology from day one instead of starting with an unrelated 2D architecture.

### Agentability

A fixed camera greatly reduces the amount of spatial control that agents need to reason about.

The game can expose semantic actions such as:

```text
dig
upgrade
inspect
rotate artifact
click artifact feature
```

instead of requiring an agent to solve a free-camera navigation problem.

---

# 10. Gameplay Layers

The underground environment should be divided into recognizable geological layers.

Example:

```text
0–10 m       Soil
10–50 m      Clay
50–150 m     Stone
150–500 m    Hard Rock
500–1,000 m  Ancient Rock
1,000–5,000 m Unknown Layer
5,000+ m     ???
```

The actual values are not fixed.

The purpose is to make progression feel physical rather than purely numerical.

Reaching a new layer should potentially change:

- visuals;
- required equipment;
- digging speed;
- available resources;
- discovery probabilities;
- background ambience.

---

# 11. Equipment Progression

The player starts with primitive equipment.

For example:

```text
Hands
  ↓
Shovel
  ↓
Pickaxe
  ↓
Steel Pickaxe
  ↓
Jackhammer
  ↓
Excavator
  ↓
Drill
  ↓
Industrial Drill
  ↓
Ridiculous Future Technology
```

The player's relationship with digging changes over time.

Early:

```text
You dig.
```

Middle:

```text
You operate equipment.
```

Late:

```text
You manage an excavation operation.
```

This evolution is a key part of the incremental-game fantasy.

---

# 12. Incremental Production

The core game should support both active and passive progression.

Early:

```text
[ DIG ]
```

Later:

```text
Manual power:        +12 / action
Automatic digging:  +184 / second
```

Eventually:

```text
Drills:              12
Excavators:           4
Workers:             84

Production:
████████████████████████
```

The player continues to perform meaningful actions while increasingly relying on automation.

---

# 13. Offline Progress

Incremental progression should continue conceptually while the player is away.

Example:

```text
Last played:
08:12

Now:
18:42

Offline:
10h 30m

Recovered:
42,381,220 excavation units
```

The engine provides timestamps and time information.

The game decides the actual offline-progress calculation.

Offline progression should be deterministic and testable.

---

# 14. Discoveries

Achievements (meta unlocks for depth, gear, idle, collection) are separate — see **Milestone 9**. This chapter is about in-world finds only.

The central secondary mechanic is discovery.

The player should always have the feeling that something interesting might be hidden underground.

Examples:

```text
🦴 Ancient bone
🪨 Flint flake
🏺 Pottery fragment
🧱 Unknown structure
💎 Strange crystal
🗿 Statue
⚙ Ancient machine
❓ Completely unexplained object
```

Discoveries can come from:

- fixed depth thresholds;
- deterministic world placement;
- controlled random rolls;
- combinations of the above.

Random mechanics should use a controllable random source so tests can reproduce outcomes.

---

# 15. 3D Artifact Inspection

Some discoveries should open a separate 3D inspection experience.

For example:

```text
FOUND:
MYSTERIOUS METAL OBJECT

[INSPECT]
```

The inspection scene should remain simple.

The object sits in the center of the screen.

The player can:

- rotate it by dragging;
- zoom where useful;
- click/tap relevant features;
- inspect markings;
- solve a small puzzle.

There is still no free camera.

Conceptually:

```text
┌────────────────────────────────────┐
│        MYSTERIOUS OBJECT           │
│                                    │
│             ╭────╮                │
│          ╭──┤ •  ├──╮              │
│          │  ╰────╯  │              │
│          │          │              │
│          ╰──────────╯              │
│                                    │
│   "Find the hidden inscription"   │
│                                    │
│              [BACK]                │
└────────────────────────────────────┘
```

This becomes the bridge between the incremental excavation game and the broader PSGE target category of simple 3D puzzle games.

---

# 16. Sample Game Scope

The first playable version should remain small.

Target:

```text
1 primary resource
5–10 upgrades
1 main active action
1 passive production mechanic
1 save game
1 offline-progress calculation
1 deterministic random discovery mechanic
1 simple collection
1 fixed-camera 3D excavation scene
```

Later (Milestone 9): a small achievements set (depth / shop / idle / discovery toasts + panel) — optional chrome, not required for the first playable loop.

The first version does not need:

- accounts;
- backend storage;
- multiplayer;
- sophisticated narrative;
- physics;
- procedural 3D worlds;
- complex combat.

---

# 17. Proposed Sample Game State

A conceptual state might look like:

```ts
interface GameState {
    version: number;

    depth: number;
    totalMaterialRemoved: number;

    resources: {
        dirt: number;
    };

    equipment: {
        shovelLevel: number;
        pickaxeLevel: number;
        drillLevel: number;
    };

    production: {
        perAction: number;
        perSecond: number;
    };

    discoveries: string[];

    lastActiveAt: number;
}
```

This is deliberately ordinary data.

The final state model should be refined after implementing real mechanics.

---

# 18. Engine Responsibilities

PSGE should own the boring infrastructure.

Likely responsibilities:

```text
PSGE
 ├── Game lifecycle
 ├── Time / game loop
 ├── Input
 ├── Asset loading
 ├── Persistence
 ├── 2D rendering support
 ├── 3D rendering integration
 ├── simple animation
 ├── browser integration
 └── development / agent tooling
```

The sample game owns:

```text
 ├── game state
 ├── game rules
 ├── progression
 ├── upgrades
 ├── discoveries
 ├── balancing
 └── game-specific presentation
```

---

# 19. Rendering Architecture

## 19.1 2.5D is the primary 3D use case initially

The first major 3D use case is not a free 3D world.

It is a fixed-camera scene.

The engine therefore needs good support for:

- loading GLB assets;
- positioning models;
- simple transforms;
- camera configuration;
- lighting;
- animation;
- object interaction;
- smooth camera movement.

It does not initially need:

- free camera controls;
- character controllers;
- physics;
- navigation meshes;
- complex world streaming.

## 19.2 Camera as a simple engine concept

The excavation camera should expose a small set of properties:

```text
position
rotation
projection
follow target / depth
```

The game should be able to express:

```text
camera follows excavation depth
```

without implementing low-level camera math itself.

The camera orientation remains fixed.

Only the camera position along the vertical excavation axis changes.

## 19.3 World and camera defaults (Milestone 1)

Locked conventions for the Endless Dig diorama:

- **Y-up** world; **1 block = 1 world unit**.
- Excavation descends along **−Y** (deeper = more negative Y).
- Camera sits on **+Z** (slight optional X offset for readable block faces), looking at the cutaway shaft.
- **Orientation is locked**; Milestone 1 may keep a fixed framing. Scrolling the camera down the shaft as depth increases is the intended progression (Milestone 6 completes polish).
- Terrain extends horizontally in **±X**; shaft cavity is open toward the camera so layers are visible in cross-section.

---

# 20. HTML / CSS UI

HTML and CSS are first-class parts of PSGE.

The engine should not replace browser UI technology.

### Shell (locked for Endless Dig)

- Canvas is **full-bleed** (`100vw` × `100vh` / dynamic viewport) — no inset card or second “window” frame.
- Title, resources, and hints are **transparent overlays** (`pointer-events: none` except interactive controls).
- Digging is **canvas click / tap**, not a dedicated DIG button in the chrome.
- Layout must remain usable across phone, tablet, desktop, and half-desktop widths.

The game UI can also contain (as overlays or panels later):

- resource counters;
- progress bars;
- upgrade panels;
- inventory;
- discovery list;
- settings;
- notifications;
- dialogs.

The 3D scene primarily communicates the world.

Conceptually:

```text
┌─ browser viewport (full bleed) ─────────────────────────┐
│  THE ENDLESS DIG          Depth 12 m   Dirt 840         │  ← HUD overlay
│                                                          │
│           block surface ──┼── block surface              │
│                           │ cutaway shaft                │
│                           ▼                              │
│                                                          │
│              (click canvas to dig)                       │
└──────────────────────────────────────────────────────────┘
```

Advertisements on the eventual hosting website can remain outside the game page, or in non-overlapping regions that do not inset the canvas into a card.

---

# 21. Time and Game Loop

PSGE should expose a simple concept of game time.

Conceptually:

```ts
interface Time {
    delta: number;
    elapsed: number;
}
```

The frame loop should use the browser's normal animation scheduling.

The engine should prevent pathological pauses from producing one enormous simulation step.

Offline time is a separate concept from frame time.

---

# 22. Input

PSGE should provide a small abstraction over browser input.

Initial targets:

- pointer;
- mouse;
- touch;
- keyboard.

The excavation game should primarily need:

```text
click / tap
```

The artifact inspection game additionally needs:

```text
drag
click / tap
optional zoom
```

No pointer lock is required.

---

# 23. Persistence

A deliberately tiny API is preferred.

Conceptually:

```ts
interface SaveStore {
    load(): Promise<unknown | null>;
    save(data: unknown): Promise<void>;
    clear(): Promise<void>;
}
```

Initial implementation:

```text
LocalSaveStore
    ↓
browser storage
```

Future:

```text
ServerSaveStore
    ↓
HTTP / backend
```

The save representation should support versioning and migration.

---

# 24. Assets

The initial asset system should support only a small number of asset categories:

```text
Images / Textures
3D Models
JSON / Data
Audio
```

Under each game, those map to:

```text
assets/
├── models/
├── textures/
├── audio/
└── data/
```

Conventions live in `AGENTS.md`. There is **no** asset metadata schema until a real asset needs one.

For Milestone 1, the primary landscape/prop `.glb` is **generated by an in-repo setup/script** (no Blender or external DCC dependency). Source recipe and generated runtime file should both be discoverable by agents.

The system should provide:

- asynchronous loading;
- caching;
- loading state;
- error reporting.

It should not initially become a sophisticated asset management platform.

---

# 25. Agent-Friendly Asset Pipeline

Assets are part of the source code of the game from the perspective of agent development.

An agent should be able to discover:

```text
What is this asset?
Where is it used?
What is its source?
Can it be regenerated?
What runtime format is expected?
What dimensions / scale / material assumptions apply?
```

For important assets, metadata should be kept in simple machine-readable files.

Example:

```json
{
  "id": "ancient-bone",
  "type": "model",
  "runtime": "ancient-bone.glb",
  "scale": 1.0,
  "description": "Ancient animal bone found during excavation"
}
```

The exact metadata schema is not yet fixed.

The general requirement is that an agent should be able to trace a runtime asset back to its source or recipe whenever practical.

---

# 26. Testing

Testing is a first-class requirement.

Both PSGE and every sample game should have automated tests from the beginning.

## 26.1 Engine tests

Test:

- time;
- persistence;
- asset loading;
- deterministic randomness;
- input abstractions;
- lifecycle;
- relevant rendering integration.

## 26.2 Game logic tests

Test:

- digging;
- upgrades;
- production;
- large values;
- offline progression;
- discoveries;
- collection;
- save/load;
- invalid state handling.

Example:

```text
create game
→ assert state
→ dig
→ assert state
→ buy upgrade
→ advance time
→ assert production
→ save
→ reload
→ assert state
```

## 26.3 Browser tests

Browser-level tests should verify:

- the application starts;
- important UI elements exist;
- controls work;
- the 3D scene loads;
- no unexpected console errors occur;
- basic gameplay works end-to-end.

## 26.4 Visual tests

Agents should be able to capture screenshots at defined checkpoints.

Examples:

```text
initial game
depth 100
new layer discovered
major upgrade
artifact inspection
completed puzzle
```

Visual regressions should be detectable automatically where practical.

---

# 27. Agent Development API

The engine should eventually expose a small development/test interface.

Conceptually:

```ts
interface GameAgentInterface {
    getState(): unknown;

    performAction(
        action: string,
        parameters?: unknown
    ): Promise<void>;

    advanceTime(
        seconds: number
    ): Promise<void>;

    save(): Promise<void>;

    reload(): Promise<void>;
}
```

This is not intended to be a player-facing API.

It is a development, testing, and agent interface.

Its purpose is to make behavior accessible without forcing agents to simulate low-level browser details for every test.

---

# 28. Public API — Unfrozen

The public PSGE API is derived from the sample game and **is never frozen**. Milestone exports may be renamed, split, or removed when a later milestone or a second game justifies it. Prefer refactoring over preserving premature contracts.

## 28.1 Milestone 1 surface (`@psge/engine`)

Intentional minimal API (names may change; intent should not for M1):

```text
createApp({ canvas, ... })      → mounts renderer, scene, fixed camera, resize
startLoop(update)               → requestAnimationFrame loop, clamped delta
loadGltf(url)                   → Promise<model>
setCamera({ position, lookAt }) → orientation stays locked to side-view convention
dispose()
```

Out of the Milestone 1 engine API on purpose: SaveStore, GameAgentInterface, follow-depth camera, full assets registry.
Hold-drag scroll (`createHoldDragScroll`) was promoted with M1.1 because deep-shaft testing required it; richer input stays for later milestones.

## 28.2 Milestone 1.1 engine primitives (unfrozen)

Extracted because they are not Dig-specific:

```text
createFloatingOrigin({ rebaseThreshold, scale?, onApply? })
createChunkWindow({ chunkSize, radius, load, unload, extraKeep? })
chunkIndex(coord, chunkSize) / chunkRange(index, chunkSize)
createHoldDragScroll({ element, onScroll, … })
```

`createApp` options also include `antialias`, `lighting` (default off), and `camera` bootstrap — games own art-direction defaults.

## 28.3 Likely later first-class concepts

```text
Game
Game State
Time
Input (beyond hold-drag)
SaveStore
Assets
2D Renderer
3D Scene
Camera
Animation
```

Concepts such as:

```text
Entity
Component
System
Prefab
EventBus
PhysicsWorld
CharacterController
```

should remain outside the public API unless real target games demonstrate a genuine need.

---

# 29. What PSGE Should Not Do

PSGE should initially avoid:

- ECS;
- physics engines;
- free-camera controller frameworks;
- sophisticated multiplayer;
- generic networking frameworks;
- visual editors;
- visual scripting;
- prefab systems;
- plugin systems;
- advanced shader frameworks;
- custom UI frameworks;
- sophisticated asset pipelines;
- console/native deployment;
- general open-world / horizontal streaming frameworks
  (a **1D vertical chunk window + floating origin** is allowed — see M1.1 / §28.2).

These can be reconsidered only when a real game requires them.

---

# 30. Development Milestones

## Milestone 0 — Agent-ready project skeleton

Deliver the npm workspaces monorepo from §3.2:

```text
/
├── package.json
├── AGENTS.md
├── packages/psge/          (@psge/engine — may be nearly empty stubs)
└── games/endless-dig/
    ├── game.json           ({ id, name, engine, entry })
    ├── AGENTS.md
    ├── src/
    ├── assets/{models,textures,audio,data}/
    ├── tests/
    └── public/
```

Acceptance criteria:

- Root scripts: `dev`, `build`, `test`, `test:e2e` documented in `AGENTS.md`.
- Vitest runs at least one engine unit test (e.g. delta clamp or seedable RNG stub).
- Playwright (Chromium): app boots (a stub page is enough before Milestone 1).
- Asset folder conventions documented; no metadata schema required yet.
- Doc and `AGENTS.md` state that the public API is unfrozen.

The sample project should already be understandable to an agent.

## Milestone 1 — Fixed-camera block cutaway

`@psge/engine` provides the Milestone 1 surface from §28.1.

Acceptance criteria:

- Browser app boots via Vite; Three.js renderer + locked perspective camera (§19.3).
- Minecraft-like **block world**: surface extending sideways + vertical shaft **cut open** toward the camera (§8.0).
- Full-bleed canvas with transparent HUD overlays (title + placeholder stats); **no** DIG button; dig affordance is canvas click (wired in M2).
- Responsive framing on narrow and wide viewports.
- `requestAnimationFrame` loop with clamped delta.
- Playwright (Chromium): full-bleed canvas, HUD present, no unexpected console errors, screenshot checkpoint.

Out of scope for Milestone 1: playable dig / removing blocks, `GameState`, SaveStore, polished camera-follow (M6).

Sample:

```text
block surface (left/right)
+
cutaway block shaft
+
fixed side camera
+
full-bleed HUD overlays
```

This milestone establishes the visual foundation immediately.

## Milestone 1.1 — Chunk streaming + floating origin

Endless / fast vertical descent must not build one absolute-Y scene of unbounded size.

### Goals

- Scroll a **very deep** cutaway shaft (target: **1 000** blocks; stress: **10 000**) without float jitter or unbounded memory.
- Manual drag-scroll already uses the same path the dig-follow camera will use later.

### Architecture (locked)

1. **Logical depth** — game/view focus is a scalar in block units (`focusBlockY`, 0 = surface, more negative = deeper). Not raw GPU coordinates.
2. **Vertical chunks** — terrain is generated in Y-slices (e.g. 16 blocks). Only chunks near the focus stay loaded; others are disposed.
3. **Floating origin** — a rebasing offset keeps rendered coordinates near zero: when `|focusBlockY - originBlockY|` exceeds a threshold, set `originBlockY = focusBlockY` and shift the world root. Instance data stays in logical block space.
4. **Surface vs deep** — the half-disk landscape loads only near the surface; deep chunks are a narrow cutaway wall strip + 2×2 shaft cavity (cheap to stream).

### Acceptance criteria

- Shaft generation extent configurable (default **1000** for M1.1; `?depth=10000` stress).
- Drag-scroll from surface to shaft floor stays smooth; no progressive slowdown from accumulating meshes.
- After long scrolls, the scene remains visually stable (no runaway precision jitter).
- `PSGE.md` / `AGENTS.md` document the approach.

Out of scope for 1.1: dig-to-reveal (shaft still pre-carved for scroll testing); SaveStore; full game state.

## Milestone 2 — Input and state

First playable dig (locked in §4.8):

- plain `GameState` + pure `dig()` (Vitest, no WebGL);
- tap canvas to dig (hold-drag scroll remains debug-only);
- **dig-to-reveal**: shaft cavity deepens with excavated `depth` (not a pre-carved tunnel);
- camera follows the dig face via the existing focus path;
- Depth / Dirt HUD counters;
- world **generation extent** = `max(1000, ?depth=, ceil(savedDepth))` — look-ahead / dig cap / deep-save reload.

Sample:

```text
tap canvas
→ depth / dirt increase
→ shaft cavity deepens
→ camera follows dig face
→ HUD updates
```

Acceptance: unit tests for `dig()`; e2e tap increases Depth/Dirt and moves focus.

## Milestone 3 — Persistence

Locked in §4.8:

- engine `SaveStore` / `createLocalSaveStore` (key e.g. `psge:endless-dig:save`);
- persist `GameState` (`version` gate; M3 accepts version 2);
- autosave: **1s** debounce, **30s** max-while-dirty, flush on `pagehide` / hidden (await in-flight; re-arm timers on save failure);
- fading **Saved** indicator (bottom-right);
- `?nosave=1` clears save for testing;
- reload with saved depth **deeper than 1000** expands generation extent (no clamp back to default).

Sample:

```text
dig → wait autosave → reload browser → depth / dirt remain
deep save (e.g. 1500) → reload → extent ≥ 1500, cavity intact
?nosave=1 → save cleared → fresh run
```

Acceptance: unit tests for SaveStore + parse + autosave controller; e2e reload restore; e2e deep-save extent; e2e nosave clears.

## Milestone 4 — Incremental mechanics

Locked in §4.8:

- **Dirt** as spendable resource; shop HUD buys level-based upgrades;
- dig power derived from shovel / pickaxe / jackhammer; generators (cart / drill / crew) grant depth/sec;
- `decimal.js` for depth, dirt, costs, rates; persist strings; `formatAmount` uses `K M B T` then `aa ab …`;
- debug tools only with `?debug=1` (give dirt, Reset, drag-scroll off by default);
- save version **3** with v2 migration.

Sample:

```text
dig → earn dirt → buy Shovel → dig power rises
buy Hand cart → depth increases without tapping
reload → upgrades / Decimal dirt remain
?debug=1 → give dirt / Reset / optional drag-scroll
```

Acceptance: unit tests for dig / buy / passive / formatAmount / v2→v3 migrate; e2e buy, passive dig, save/reload upgrades, debug slider gate.

## Milestone 5 — Offline progression

Locked (see also §4.8):

- Persist `lastPlayedAtMs` (save version **4**); autosave refreshes it while playing.
- On load / tab return, if auto-dig owned and away ≥ **30s**: claim modal with duration + depth/dirt; shorter hides get full-rate catch-up.
- Payout: `softDigAmount(passiveRate) × hardness(layer) × min(elapsed, 24h) × (1/6)`; dirt = depth × 4.
- Automatic saving already from M3; M5 keeps the offline clock coherent with saves.
- Tests: pure offline helpers + `?offlineMs=` e2e claim path.

## Milestone 6 — Excavation presentation

Locked (see also §4.8):

- **Geo layers:** Topsoil 0–1 000 m → Packed clay → Bedrock → Deep crust → Ancient rock → The Abyss; hardness multiplies soft-capped dig.
- **Mood:** fog / sky / lights + block palette family per layer; dig chips tint to the layer.
- **Actors:** procedural digger (swing on tap, tool from upgrades) + cart / drill / crew props.
- Particles (burst/trickle) already from earlier milestones; orientation stays locked (framing may tighten later for playability).
- Tests: `geoLayers` helpers + hardness on dig; e2e `data-psge-layer` at depth ≥ 1000.

The camera remains fixed in orientation throughout.

## Milestone 7 — Discoveries

Locked (see also §4.8):

- **Catalog** (`discoveries.ts`): milestones at band depths + rare seeded dig rolls (`createSeededRng`).
- **Collection** sheet (FAB) + find-reveal modal (queued, auto-close); CSS icon tiles (placeholder art).
- **Shaft props** (`discoveryProps.ts`): basic procedural meshes for unlocked / teased milestones.
- Save version **7** (`discoveries` + dirt-coin boosters + `specialCoins.unlocked`); resolve on dig / tick / offline / `?depth=` fresh runs; v2–v6 migrate.
- Dirt-coin boosters (`boosters.ts`): ~25–50 m apart; tap depth×combo mult (surface ~×2, deep ~×5; combo +0.25/step cap ×3; persisted streak, 30s wall-clock / auto-miss reset) / auto ×1 after **6 m** dig-past grace; short claim toast; HUD “Dirt coins”. Save **v10**.
- **20** special collectible coins (`specialCoins.ts`): ~220–480 m apart; same grace; tap premium from **2K** dirt (scales with depth); find reveal + coin collection sheet.
- Soft dig uses a linear floor so late upgrades stay meaningful; effective dig = soft × layer hardness (tap, auto, offline, short catch-up).
- FAB sheets for shop / finds / coins / debug on all viewports; dig while open (wide: right dock; narrow ≤520px: bottom sheets). Auto **Pause** stops live auto-dig so players can grab coins.
- Out of scope: 3D inspect (M10).

## Milestone 8 — Agent development loop

Process / benchmark milestone (not a new dig-loop system). Prove agents can ship a small Endless Dig feature end-to-end.

Canonical exercise (for agents practicing the loop — do **not** leave throwaway shop SKUs after the proof):

```text
Add a temporary tap upgrade end-to-end (shop row, dig-power effect, tests),
verify via hooks / e2e / screenshot, then remove it unless it earns a real
progression niche.
```

Agent path to demonstrate:

```text
modify code
→ modify/add assets if necessary
→ add tests
→ build
→ launch
→ interact with game
→ inspect state
→ capture screenshot
→ verify result
```

### Locked acceptance

- Repo + game `AGENTS.md` document the agent loop (commands, URL flags, `__psge*` hooks, verify recipe).
- E2e covers interact → inspect state (`__psgeState` / `data-psge-dig-power`) → screenshot on a real shop buy (e.g. shovel).
- `data-psge-milestone` reflects the current milestone (9 while M9 is current).
- Out of scope: 3D inspect, achievements UI, new engine APIs unless strictly required for the benchmark; permanent “proof-only” upgrades.

## Milestone 9 — Achievements

Meta progression distinct from **Discoveries** (M7): discoveries are in-world finds; achievements are durable unlocks for reaching milestones of play (depth, upgrades, idle, collection).

### Locked

- Game-owned catalog + `evaluateAchievements` (`achievements.ts`); toast-only (no dig-power rewards).
- Save version **8** (`achievements.unlocked` + `afkDigSeen` / `overnightClaimed`); v2–v7 migrate.
- FAB Achievements sheet (dig while open) + toast queue; `data-psge-achievements-count`.
- Deterministic Vitest predicates; e2e `first-dig` + reload retain.

### Catalog (MVP)

| Id | Trigger |
| --- | --- |
| `first-dig` | depth &gt; 0 |
| `depth-10` / `depth-100` / `depth-1k` / `depth-10k` | depth thresholds |
| `layer-clay` … `layer-abyss` | geo layer reached (skip soil) |
| `first-purchase` | any upgrade ≥ 1 |
| `own-shovel` / `own-pickaxe` / `own-jackhammer` | that upgrade ≥ 1 |
| `full-kit` | shovel + pickaxe + jackhammer |
| `cart-crew` | cart / drill / crew |
| `afk-digger` | passive dig advanced depth once |
| `dirt-hoarder` | dirt ≥ 1 000 |
| `overnight` | offline claim completed |
| `first-find` / `collector` / `museum` | 1 / 5 / all discoveries |

Out of MVP: `inspector` (M10), `surface-dweller`, `long-haul`, `spendthrift`.

Do **not** gate the dig loop behind achievements.

### Acceptance

- Unit tests for unlock predicates + save migrate v7→v8.
- E2e: `first-dig` toast/sheet; reload retains unlocked id.
- Docs distinguish achievements (M9) from discoveries (M7).

Out of scope for M9: cloud sync, leaderboards, Steam-style rare %, monetized unlocks.

## Milestone 10 — 3D artifact inspection

Deferred: the dig loop plays well without inspect. Add when ready as a bridge to simple 3D puzzle scenes (§15).

Add:

- artifact loading (engine `loadGltf` and/or procedural placeholder);
- fixed inspection camera;
- drag-to-rotate;
- object interaction;
- simple puzzle;
- entry from find reveal and/or collection sheet for selected discoveries.

Out of scope until M10: free camera, large puzzle graphs, full catalog of inspectables.

---

# 31. Monetization / Hosting

The eventual website should monetize games primarily through advertising.

Advertisements should remain outside the game's rendering system.

Conceptually:

```text
┌───────────────────────────────────────────────────────┐
│ Website                                               │
│                                                       │
│  ┌───────────────┐    ┌───────────────────────────┐  │
│  │ Advertisement │    │                           │  │
│  └───────────────┘    │         PSGE GAME         │  │
│                       │                           │  │
│                       └───────────────────────────┘  │
│                                                       │
│                   ┌───────────────────────────┐       │
│                   │       Advertisement       │       │
│                   └───────────────────────────┘       │
└───────────────────────────────────────────────────────┘
```

PSGE should integrate cleanly into an ordinary HTML page.

The engine should not be tied to a particular advertising provider.

---

# 32. Hosting Architecture

A potential long-term architecture is:

```text
Game Website
    │
    ├── Game catalog
    ├── Game page
    ├── Ads
    └── PSGE game
           │
           ├── HTML/CSS UI
           ├── PSGE runtime
           └── Game assets
```

A game should ideally be independently buildable and deployable.

This supports both independent game development and hosting many games through one website.

---

# 33. Long-Term Networking

The initial games are local-first.

Networking should nevertheless remain possible.

Potential future features:

- server-backed saves;
- accounts;
- leaderboards;
- statistics;
- cloud backups;
- live events.

These should be layered on later rather than driving the initial engine architecture.

---

# 34. Design Rules

Whenever a new engine feature is proposed, ask:

1. Does a real target game need it?
2. Does it make the game meaningfully simpler?
3. Can ordinary TypeScript or browser APIs solve the problem?
4. Can an existing library solve it?
5. Can an agent understand and use it easily?
6. Can it be tested deterministically?
7. Does it introduce more concepts than it removes?

A particularly important rule is:

> **If a feature makes PSGE feel more like a traditional game engine, stop and ask whether it is actually necessary.**

Another equally important rule is:

> **If an agent cannot easily understand, modify, test, and verify a feature, the feature or its surrounding architecture is probably too complicated.**

---

# 35. Current Technical Questions

## Resolved for Milestone 0 / 1 / 1.1 / 2 / 3 / 4 / 5 / 6 / 7 / 8 / 9

See §4.8 for the decision table. In short:

- Toolchain: npm, Vite, Vitest, Playwright (Chromium); no hardcoded browser matrix.
- Layout: monorepo with `@psge/engine` and `games/endless-dig`.
- M1 API surface: §28.1 (`createApp`, `startLoop`, `loadGltf`, `setCamera`, `dispose`).
- Camera/world defaults: §19.3 (Y-up, depth −Y, camera +Z, 1 block = 1 unit).
- M1.1: vertical chunks + floating origin; `?depth=` testing helper (with save rules in M3).
- M2: dig-to-reveal + camera follow; drag-scroll debug-only; game-owned `GameState`.
- M3: `SaveStore` / `createLocalSaveStore`; 1s debounce + 30s max autosave; `?nosave=1` clears.
- M4: dirt shop + upgrades + passive dig; `decimal.js` + idle `formatAmount`; `?debug=1` give dirt / Reset / drag-scroll.
- M5: offline claim when away ≥30s at soft auto × hardness × 1/6 (max 24h); shorter hides catch up at full rate; save v4 `lastPlayedAtMs`; `?offlineMs=`.
- M6: km geo layers + hardness; mood/palette; procedural digger + crew/machinery props.
- M7: discoveries + find reveal; dirt-coin boosters (6 m grace); 20 special coins (depth-scaled tap premium); FAB dig-while-open sheets; soft dig linear floor; save v7.
- M8: agent development loop playbook + e2e verify path (shop buy / state / screenshot); 3D inspect deferred to M10.
- M9: achievements catalog + toast/FAB sheet; save v8; distinct from discoveries.
- Assets: folder layout under `assets/`; no metadata schema yet.
- API policy: unfrozen (§28).

## Technology (still open)

- Three.js version pinning strategy (use current stable until a reason to pin appears).
- Exact Node.js version for CI (unconstrained for now).

## Engine API (still open; after M1)

- Exact `Game` lifecycle?
- How should state updates be modeled?
- How should input be exposed beyond hold-drag?
- How should assets be referenced beyond `loadGltf`?
- How should the agent/test interface be exposed?

## 2.5D rendering (still open; mostly M6+)

- Exact perspective FOV / framing numbers?
- How should the excavation cross-section be modeled in detail?
- How should underground lighting work?
- How should camera-follow depth be implemented (M6)?
- How should distant layers be represented if depth becomes extreme?

## Assets (still open; after M1)

- Preferred modeling tool for authored (non-generated) assets?
- Texture-generation workflow?
- Asset metadata format when first needed?
- Which assets need source/recipe files when GLBs are first authored?
- How should agent-generated assets be validated?

## Sample game

- Final name?
- Achievement set size / whether any grant a tiny reward vs toast-only? (M9)
- Artifact puzzle mechanics? (M10)
- Further upgrade-tree / economy tuning beyond current soft dig + shop?

## Hosting

- Game packaging?
- Asset deployment?
- Caching?
- Ads?
- Analytics?
- Privacy / consent?

---

# 36. Development Philosophy

The engine should grow out of actual games.

The sample game is both:

1. a real game;
2. a continuous source of requirements for PSGE.

The sample game should therefore be developed alongside the engine, but remain strictly separate from it.

The public API should not be frozen before the sample game has exercised the relevant capabilities.

The most important overall principle is:

> **Build the smallest technology that makes the game easy to create — then make that technology easy for agents to understand and extend.**

The desired end state is that creating a PSGE game feels closer to building a small TypeScript web application with a 3D scene than to building a project in a heavyweight game engine.
