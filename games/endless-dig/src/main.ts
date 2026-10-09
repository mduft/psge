import { createApp } from "@psge/engine";
import { createShaftScroll } from "./cameraScroll.js";
import { buildDigWorld } from "./world.js";

function main(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
  if (!canvas) {
    throw new Error("Expected #game-canvas");
  }

  const app = createApp({ canvas, background: 0x87b7e0, fov: 30 });
  const world = buildDigWorld(app.scene, { initialShaftDepth: 12 });

  const scroll = createShaftScroll({
    app,
    canvas,
    initialFocusY: world.getFocusY(),
    shaftDepthBlocks: world.getShaftDepth(),
    onTap: () => {
      document.documentElement.dataset.psgeDigIntent = "1";
    },
  });

  window.addEventListener("resize", () => scroll.apply());

  const depthEl = document.querySelector('[data-stat="depth"]');
  if (depthEl) {
    depthEl.textContent = `${world.getShaftDepth()} m`;
  }

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
  document.documentElement.dataset.psgeMilestone = "1";
}

try {
  main();
} catch (err) {
  console.error(err);
  document.documentElement.dataset.psgeError = "true";
}
