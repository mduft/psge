import { createApp, type LightingOptions } from "@psge/engine";
import { createShaftScroll } from "./cameraScroll.js";
import { BLOCK_SCALE, buildDigWorld } from "./world.js";

/** Outdoor cutaway lighting — Dig-specific, not engine defaults. */
const DIG_LIGHTING: LightingOptions = {
  hemisphere: { sky: 0xe8f2ff, ground: 0x4a3424, intensity: 0.85 },
  ambient: { color: 0xffffff, intensity: 0.45 },
  directional: [
    { color: 0xfff2d8, intensity: 1.25, position: [10, 28, 18] },
    { color: 0xb8d4ff, intensity: 0.35, position: [-12, 10, 8] },
  ],
};

function readShaftDepth(): number {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("depth");
  if (!raw) return 1000;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 1000;
}

function main(): () => void {
  const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
  if (!canvas) {
    throw new Error("Expected #game-canvas");
  }

  const shaftDepth = readShaftDepth();
  const app = createApp({
    canvas,
    background: 0x87b7e0,
    antialias: false,
    lighting: DIG_LIGHTING,
    camera: { fov: 30, far: 400 },
  });
  const world = buildDigWorld(app.scene, { shaftDepth });

  const applyCamera = (): void => {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const distance = aspect < 0.85 ? 34 : aspect < 1.15 ? 30 : 27;
    const xOffset = aspect < 0.85 ? 1.4 : 2.6;
    const yLift = 8.5;
    const focusY = world.getRenderFocusY();

    app.setCamera({
      position: [xOffset * BLOCK_SCALE, focusY + yLift, distance],
      lookAt: [0, focusY - 1.5, -6 * BLOCK_SCALE],
    });
  };

  const viewEl = document.querySelector('[data-stat="view"]');
  const chunkEl = document.querySelector('[data-stat="chunk"]');
  const logicalEl = document.querySelector('[data-stat="logical"]');
  const originEl = document.querySelector('[data-stat="origin"]');
  const engineEl = document.querySelector('[data-stat="engine"]');
  const chunksEl = document.querySelector('[data-stat="chunks"]');
  const depthEl = document.querySelector('[data-stat="depth"]');
  if (depthEl) {
    depthEl.textContent = `${shaftDepth} m`;
  }

  const fmt = (n: number, digits = 2): string =>
    n.toLocaleString("en-US", {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    });

  const updateHud = (): void => {
    const logical = world.getFocusBlockY();
    const viewDepth = Math.max(0, -logical);
    if (viewEl) viewEl.textContent = `${fmt(viewDepth, 1)} m`;
    if (chunkEl) chunkEl.textContent = String(world.getFocusChunkIndex());
    if (logicalEl) logicalEl.textContent = fmt(logical, 2);
    if (originEl) originEl.textContent = fmt(world.getOriginBlockY(), 2);
    if (engineEl) engineEl.textContent = fmt(world.getRenderFocusY(), 2);
    if (chunksEl) chunksEl.textContent = String(world.getLoadedChunkCount());
  };

  const scroll = createShaftScroll({
    world,
    canvas,
    applyCamera,
    onFocusBlockY: updateHud,
    onTap: () => {
      document.documentElement.dataset.psgeDigIntent = "1";
    },
  });

  const onResize = (): void => scroll.apply();
  window.addEventListener("resize", onResize);
  updateHud();

  app.startLoop();

  const dbg = window as Window & {
    __psgeApp?: typeof app;
    __psgeWorld?: typeof world;
    __psgeScroll?: typeof scroll;
  };
  dbg.__psgeApp = app;
  dbg.__psgeWorld = world;
  dbg.__psgeScroll = scroll;

  document.documentElement.dataset.psgeReady = "true";
  document.documentElement.dataset.psgeMilestone = "1.1";
  document.documentElement.dataset.psgeShaftDepth = String(shaftDepth);

  return () => {
    window.removeEventListener("resize", onResize);
    scroll.dispose();
    world.dispose();
    app.dispose();
    delete dbg.__psgeApp;
    delete dbg.__psgeWorld;
    delete dbg.__psgeScroll;
  };
}

try {
  const dispose = main();
  const hot = (import.meta as ImportMeta & { hot?: { dispose: (cb: () => void) => void } })
    .hot;
  hot?.dispose(() => dispose());
} catch (err) {
  console.error(err);
  document.documentElement.dataset.psgeError = "true";
}
