/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { createApp, type LightingOptions } from "@psge/engine";
import { createShaftScroll } from "./cameraScroll.js";
import {
  createInitialState,
  DEFAULT_DIG_POWER,
  dig,
  SHAFT_CROSS_SECTION,
  type GameState,
} from "./gameState.js";
import { BLOCK_SCALE, buildDigWorld } from "./world.js";

/** Slider uses integer steps of DEFAULT_DIG_POWER (1 = 1/32 block). */
const DIG_POWER_SLIDER_MAX = 256;

/** Outdoor cutaway lighting — Dig-specific, not engine defaults. */
const DIG_LIGHTING: LightingOptions = {
  hemisphere: { sky: 0xe8f2ff, ground: 0x4a3424, intensity: 0.85 },
  ambient: { color: 0xffffff, intensity: 0.45 },
  directional: [
    { color: 0xfff2d8, intensity: 1.25, position: [10, 28, 18] },
    { color: 0xb8d4ff, intensity: 0.35, position: [-12, 10, 8] },
  ],
};

const DEFAULT_WORLD_EXTENT = 1000;

/**
 * `?depth=N` (testing): start already excavated to N meters and generate at least that far.
 * Omit for normal play (dug 0, extent 1000).
 */
function readDepthQuery(): { excavatedDepth: number; worldExtent: number } {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("depth");
  if (!raw) {
    return { excavatedDepth: 0, worldExtent: DEFAULT_WORLD_EXTENT };
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return { excavatedDepth: 0, worldExtent: DEFAULT_WORLD_EXTENT };
  }
  return {
    excavatedDepth: n,
    worldExtent: Math.max(n, DEFAULT_WORLD_EXTENT),
  };
}

/** Focus slightly above the dig face so the floor stays in frame. */
function focusForDepth(depth: number): number {
  return -depth + 0.35;
}

function main(): () => void {
  const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
  if (!canvas) {
    throw new Error("Expected #game-canvas");
  }

  const { excavatedDepth: startDepth, worldExtent } = readDepthQuery();
  const state = createInitialState({
    depth: startDepth,
    dirt: startDepth * SHAFT_CROSS_SECTION,
  });
  const app = createApp({
    canvas,
    background: 0x87b7e0,
    antialias: false,
    lighting: DIG_LIGHTING,
    camera: { fov: 30, far: 400 },
  });
  const world = buildDigWorld(app.scene, {
    worldExtent,
    excavatedDepth: state.depth,
  });

  const applyCamera = (): void => {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const distance = aspect < 0.85 ? 34 : aspect < 1.15 ? 30 : 27;
    const xOffset = aspect < 0.85 ? 1.4 : 2.6;
    /** Pan only (same delta on eye + lookAt) so side-view angle stays fixed. */
    const panX = (aspect < 0.85 ? -0.3 : -0.6) * BLOCK_SCALE;
    const yLift = 8.5;
    const focusY = world.getRenderFocusY();

    app.setCamera({
      position: [xOffset * BLOCK_SCALE + panX, focusY + yLift, distance],
      lookAt: [panX, focusY - 1.5, -6 * BLOCK_SCALE],
    });
  };

  const depthEl = document.querySelector('[data-stat="depth"]');
  const dirtEl = document.querySelector('[data-stat="dirt"]');
  const digPowerEl = document.querySelector('[data-stat="dig-power"]');
  const digPowerInput = document.querySelector<HTMLInputElement>("#dig-power");

  const fmt = (n: number, digits = 2): string =>
    n.toLocaleString("en-US", {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    });

  const formatDigPower = (power: number): string => {
    const steps = Math.round(power / DEFAULT_DIG_POWER);
    if (steps <= 1) return "1/32";
    if (steps % 32 === 0) return `${steps / 32}`;
    return `${steps}/32`;
  };

  const syncFromState = (): void => {
    world.setExcavatedDepth(state.depth);
    world.setFocusBlockY(focusForDepth(state.depth));
  };

  const updateHud = (): void => {
    if (depthEl) depthEl.textContent = `${fmt(state.depth, 2)} m`;
    if (dirtEl) dirtEl.textContent = fmt(state.dirt, 1);
    if (digPowerEl) digPowerEl.textContent = formatDigPower(state.digPower);
    if (digPowerInput) {
      digPowerInput.value = String(
        Math.round(state.digPower / DEFAULT_DIG_POWER),
      );
      digPowerInput.setAttribute(
        "aria-valuetext",
        `${formatDigPower(state.digPower)} block`,
      );
    }
  };

  const onDigPowerInput = (): void => {
    if (!digPowerInput) return;
    const steps = Math.min(
      DIG_POWER_SLIDER_MAX,
      Math.max(1, Number.parseInt(digPowerInput.value, 10) || 1),
    );
    state.digPower = steps * DEFAULT_DIG_POWER;
    updateHud();
  };
  digPowerInput?.addEventListener("input", onDigPowerInput);
  // Keep slider drags from reaching the canvas dig/scroll handlers.
  digPowerInput?.addEventListener("pointerdown", (e) => e.stopPropagation());

  const applyPlayView = (): void => {
    syncFromState();
    applyCamera();
    updateHud();
  };

  const scroll = createShaftScroll({
    world,
    canvas,
    applyCamera,
    onFocusBlockY: updateHud,
    onTap: () => {
      dig(state, worldExtent);
      document.documentElement.dataset.psgeDigIntent = "1";
      document.documentElement.dataset.psgeDepth = String(state.depth);
      document.documentElement.dataset.psgeDirt = String(state.dirt);
      applyPlayView();
    },
  });

  const onResize = (): void => {
    applyCamera();
    updateHud();
  };
  window.addEventListener("resize", onResize);
  applyPlayView();

  app.startLoop();

  const dbg = window as Window & {
    __psgeApp?: typeof app;
    __psgeWorld?: typeof world;
    __psgeScroll?: typeof scroll;
    __psgeState?: GameState;
  };
  dbg.__psgeApp = app;
  dbg.__psgeWorld = world;
  dbg.__psgeScroll = scroll;
  dbg.__psgeState = state;

  document.documentElement.dataset.psgeReady = "true";
  document.documentElement.dataset.psgeMilestone = "2";
  document.documentElement.dataset.psgeWorldExtent = String(worldExtent);
  document.documentElement.dataset.psgeDepth = String(state.depth);
  document.documentElement.dataset.psgeDirt = String(state.dirt);

  return () => {
    window.removeEventListener("resize", onResize);
    digPowerInput?.removeEventListener("input", onDigPowerInput);
    scroll.dispose();
    world.dispose();
    app.dispose();
    delete dbg.__psgeApp;
    delete dbg.__psgeWorld;
    delete dbg.__psgeScroll;
    delete dbg.__psgeState;
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
