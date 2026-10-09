/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import {
  createApp,
  createLocalSaveStore,
  type LightingOptions,
} from "@psge/engine";
import Decimal from "decimal.js";
import { createAutosave } from "./autosave.js";
import { createShaftScroll } from "./cameraScroll.js";
import { digCameraFraming } from "./digCamera.js";
import { applyDigCursor, digToolOf } from "./digCursor.js";
import { formatAmount } from "./formatAmount.js";
import { focusForDepth } from "./softDig.js";
import {
  buyUpgrade,
  canBuyUpgrade,
  createInitialState,
  DEFAULT_DIG_POWER,
  dig,
  digPowerOf,
  passiveRateOf,
  resetProgress,
  SHAFT_CROSS_SECTION,
  tickProduction,
  type GameState,
} from "./gameState.js";
import { DIG_SAVE_KEY, loadGameState, saveGameState } from "./persist.js";
import {
  UPGRADE_DEFS,
  upgradeCost,
  type UpgradeId,
} from "./upgrades.js";
import {
  BLOCK_SCALE,
  buildDigWorld,
  WORLD_EXTENT_LOOKAHEAD,
} from "./world.js";

const DEFAULT_WORLD_EXTENT = 1000;
const SAVE_INDICATOR_MS = 1800;

/** Outdoor cutaway lighting — Dig-specific, not engine defaults. */
const DIG_LIGHTING: LightingOptions = {
  hemisphere: { sky: 0xe8f2ff, ground: 0x4a3424, intensity: 0.85 },
  ambient: { color: 0xffffff, intensity: 0.45 },
  directional: [
    { color: 0xfff2d8, intensity: 1.25, position: [10, 28, 18] },
    { color: 0xb8d4ff, intensity: 0.35, position: [-12, 10, 8] },
  ],
};

function readQueryFlags(): {
  excavatedDepth: number;
  worldExtent: number;
  nosave: boolean;
  debug: boolean;
} {
  const params = new URLSearchParams(window.location.search);
  const nosave =
    params.get("nosave") === "1" || params.get("nosave") === "true";
  const debug =
    params.get("debug") === "1" || params.get("debug") === "true";

  const raw = params.get("depth");
  if (!raw) {
    return {
      excavatedDepth: 0,
      worldExtent: DEFAULT_WORLD_EXTENT,
      nosave,
      debug,
    };
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return {
      excavatedDepth: 0,
      worldExtent: DEFAULT_WORLD_EXTENT,
      nosave,
      debug,
    };
  }
  return {
    excavatedDepth: n,
    worldExtent: Math.max(n, DEFAULT_WORLD_EXTENT),
    nosave,
    debug,
  };
}

function freshState(excavatedDepth: number): GameState {
  return createInitialState({
    depth: excavatedDepth,
    dirt: excavatedDepth * SHAFT_CROSS_SECTION,
  });
}

function depthNumber(state: GameState): number {
  return state.depth.toNumber();
}

function formatDigPower(power: Decimal): string {
  const steps = power.div(DEFAULT_DIG_POWER).round().toNumber();
  if (steps <= 1) return "1/32";
  if (steps % 32 === 0) return `${steps / 32}`;
  return `${steps}/32`;
}

async function boot(): Promise<() => void> {
  const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
  if (!canvas) {
    throw new Error("Expected #game-canvas");
  }

  const {
    excavatedDepth: depthQuery,
    worldExtent: extentFromQuery,
    nosave,
    debug,
  } = readQueryFlags();
  const store = createLocalSaveStore({ key: DIG_SAVE_KEY });

  let state: GameState;
  if (nosave) {
    await store.clear();
    state = freshState(depthQuery);
  } else {
    const loaded = await loadGameState(store);
    state = loaded ?? freshState(depthQuery);
  }

  // Extent must cover query depth and any deeper saved progress.
  const worldExtent = Math.max(
    DEFAULT_WORLD_EXTENT,
    extentFromQuery,
    Math.ceil(depthNumber(state)),
  );

  const app = createApp({
    canvas,
    background: 0x87b7e0,
    antialias: false,
    lighting: DIG_LIGHTING,
    camera: { fov: 30, far: 400 },
  });
  const world = buildDigWorld(app.scene, {
    worldExtent,
    excavatedDepth: depthNumber(state),
  });

  const applyCamera = (): void => {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const { distance, xOffset, panXBlocks } = digCameraFraming(aspect);
    /** Pan only (same delta on eye + lookAt) so side-view angle stays fixed. */
    const panX = panXBlocks * BLOCK_SCALE;
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
  const passiveEl = document.querySelector('[data-stat="passive"]');
  const debugPanel = document.querySelector<HTMLElement>("#debug-panel");
  const debugScroll = document.querySelector<HTMLInputElement>("#debug-scroll");
  const shopList = document.querySelector<HTMLElement>("#shop-list");
  const shopToggle =
    document.querySelector<HTMLButtonElement>("#shop-toggle");
  const shopClose = document.querySelector<HTMLButtonElement>("#shop-close");
  const shopBackdrop = document.querySelector<HTMLElement>("#shop-backdrop");
  const shopAffordDot =
    document.querySelector<HTMLElement>("[data-shop-afford]");
  const resetButton =
    document.querySelector<HTMLButtonElement>("#reset-progress");
  const saveIndicator = document.querySelector("#save-indicator");

  const setShopOpen = (open: boolean): void => {
    document.documentElement.dataset.psgeShop = open ? "open" : "closed";
    shopToggle?.setAttribute("aria-expanded", open ? "true" : "false");
    if (shopBackdrop) {
      if (open) shopBackdrop.removeAttribute("hidden");
      else shopBackdrop.setAttribute("hidden", "");
    }
  };
  setShopOpen(false);

  if (debug) {
    debugPanel?.removeAttribute("hidden");
    document.documentElement.dataset.psgeDebug = "1";
  } else {
    debugPanel?.setAttribute("hidden", "");
    delete document.documentElement.dataset.psgeDebug;
  }

  const ensureExtentForPlay = (): void => {
    const needed =
      Math.ceil(depthNumber(state)) + WORLD_EXTENT_LOOKAHEAD;
    if (world.ensureWorldExtent(needed)) {
      document.documentElement.dataset.psgeWorldExtent = String(
        world.getWorldExtent(),
      );
    }
  };

  let saveFadeTimer = 0;
  const showSavedIndicator = (): void => {
    if (!saveIndicator) return;
    saveIndicator.classList.add("is-visible");
    saveIndicator.setAttribute("aria-hidden", "false");
    document.documentElement.dataset.psgeSaved = "1";
    if (saveFadeTimer !== 0) clearTimeout(saveFadeTimer);
    saveFadeTimer = window.setTimeout(() => {
      saveFadeTimer = 0;
      saveIndicator.classList.remove("is-visible");
      saveIndicator.setAttribute("aria-hidden", "true");
    }, SAVE_INDICATOR_MS);
  };

  const autosave = createAutosave({
    store,
    getState: () => state,
    onSaved: showSavedIndicator,
  });

  const shopButtons = new Map<UpgradeId, HTMLButtonElement>();

  const syncFromState = (): void => {
    ensureExtentForPlay();
    const d = depthNumber(state);
    world.setExcavatedDepth(d);
    world.setFocusBlockY(focusForDepth(d));
  };

  const updateHud = (): void => {
    const power = digPowerOf(state);
    const passive = passiveRateOf(state);
    if (depthEl) depthEl.textContent = `${formatAmount(state.depth)} m`;
    if (dirtEl) dirtEl.textContent = formatAmount(state.dirt);
    if (digPowerEl) digPowerEl.textContent = formatDigPower(power);
    if (passiveEl) {
      passiveEl.textContent = `${formatAmount(passive)}/s`;
    }

    let anyAffordable = false;
    for (const def of UPGRADE_DEFS) {
      const level = state.upgrades[def.id];
      const cost = upgradeCost(def.id, level);
      const affordable = canBuyUpgrade(state, def.id);
      if (affordable) anyAffordable = true;
      const effect = shopList?.querySelector(`[data-shop-effect="${def.id}"]`);
      if (effect) {
        effect.textContent = `Lv ${level} · ${def.effectLabel} · ${formatAmount(cost)} dirt`;
      }
      const buy = shopButtons.get(def.id);
      if (buy) {
        buy.textContent = "Buy";
        buy.disabled = !affordable;
      }
    }
    if (shopAffordDot) {
      if (anyAffordable) shopAffordDot.removeAttribute("hidden");
      else shopAffordDot.setAttribute("hidden", "");
    }
    shopToggle?.classList.toggle("has-affordable", anyAffordable);

    document.documentElement.dataset.psgeDepth = state.depth.toString();
    document.documentElement.dataset.psgeDirt = state.dirt.toString();
    applyDigCursor(canvas, digToolOf(state.upgrades));
  };

  const applyPlayView = (): void => {
    syncFromState();
    applyCamera();
    updateHud();
  };

  const buildShop = (): void => {
    if (!shopList) return;
    shopList.replaceChildren();
    shopButtons.clear();
    for (const def of UPGRADE_DEFS) {
      const row = document.createElement("div");
      row.className = "shop-row";
      row.dataset.upgrade = def.id;

      const meta = document.createElement("div");
      meta.className = "shop-meta";
      const name = document.createElement("span");
      name.className = "shop-name";
      name.textContent = def.name;
      const effect = document.createElement("span");
      effect.className = "shop-effect";
      effect.dataset.shopEffect = def.id;
      meta.append(name, effect);

      const buy = document.createElement("button");
      buy.type = "button";
      buy.className = "shop-buy";
      buy.dataset.shopBuy = def.id;
      buy.addEventListener("pointerdown", (e) => e.stopPropagation());
      buy.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!buyUpgrade(state, def.id)) return;
        applyPlayView();
        autosave.markDirty();
      });

      row.append(meta, buy);
      shopList.append(row);
      shopButtons.set(def.id, buy);
    }
  };

  buildShop();

  const onShopToggle = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    setShopOpen(document.documentElement.dataset.psgeShop !== "open");
  };
  const onShopClose = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    setShopOpen(false);
  };
  shopToggle?.addEventListener("click", onShopToggle);
  shopToggle?.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  shopClose?.addEventListener("click", onShopClose);
  shopClose?.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  shopBackdrop?.addEventListener("click", onShopClose);
  shopBackdrop?.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  const shopSheet = document.querySelector<HTMLElement>("#shop-sheet");
  shopSheet?.addEventListener("pointerdown", (ev) => ev.stopPropagation());

  const onGiveDirt = (e: Event): void => {
    const btn = e.currentTarget as HTMLButtonElement;
    const amount = Number.parseFloat(btn.dataset.giveDirt ?? "");
    if (!Number.isFinite(amount) || amount <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    state.dirt = state.dirt.plus(amount);
    applyPlayView();
  };
  const giveDirtButtons = [
    ...document.querySelectorAll<HTMLButtonElement>("[data-give-dirt]"),
  ];
  for (const btn of giveDirtButtons) {
    btn.addEventListener("click", onGiveDirt);
    btn.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  }

  const onReset = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    void (async () => {
      resetProgress(state);
      applyPlayView();
      await store.clear();
      await saveGameState(store, state);
      showSavedIndicator();
    })().catch((err) => console.error(err));
  };
  resetButton?.addEventListener("click", onReset);
  resetButton?.addEventListener("pointerdown", (e) => e.stopPropagation());

  const scroll = createShaftScroll({
    world,
    canvas,
    applyCamera,
    onFocusBlockY: updateHud,
    // Drag-scroll is debug-only and off by default (opt in via checkbox).
    scrollEnabled: false,
    onTap: () => {
      dig(state);
      document.documentElement.dataset.psgeDigIntent = "1";
      applyPlayView();
      world.burstDigParticles();
      autosave.markDirty();
    },
  });

  if (debug && debugScroll) {
    debugScroll.checked = false;
    const onScrollToggle = (): void => {
      scroll.setScrollEnabled(debugScroll.checked);
    };
    debugScroll.addEventListener("change", onScrollToggle);
    debugScroll.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  const onResize = (): void => {
    applyCamera();
    updateHud();
  };
  window.addEventListener("resize", onResize);

  const flushSave = (): void => {
    void autosave.flush().catch((err) => console.error(err));
  };
  const onPageHide = (): void => flushSave();
  const onVisibility = (): void => {
    if (document.visibilityState === "hidden") flushSave();
  };
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", onVisibility);

  applyPlayView();
  app.startLoop((dt) => {
    world.update(dt);
    if (!tickProduction(state, dt)) return;
    syncFromState();
    applyCamera();
    updateHud();
    autosave.markDirty();
  });

  const dbg = window as Window & {
    __psgeApp?: typeof app;
    __psgeWorld?: typeof world;
    __psgeScroll?: typeof scroll;
    __psgeState?: GameState;
    __psgeSaveStore?: typeof store;
  };
  dbg.__psgeApp = app;
  dbg.__psgeWorld = world;
  dbg.__psgeScroll = scroll;
  dbg.__psgeState = state;
  dbg.__psgeSaveStore = store;

  document.documentElement.dataset.psgeReady = "true";
  document.documentElement.dataset.psgeMilestone = "4";
  document.documentElement.dataset.psgeWorldExtent = String(
    world.getWorldExtent(),
  );
  document.documentElement.dataset.psgeNosave = nosave ? "1" : "0";
  updateHud();

  return () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVisibility);
    shopToggle?.removeEventListener("click", onShopToggle);
    shopClose?.removeEventListener("click", onShopClose);
    shopBackdrop?.removeEventListener("click", onShopClose);
    resetButton?.removeEventListener("click", onReset);
    for (const btn of giveDirtButtons) {
      btn.removeEventListener("click", onGiveDirt);
    }
    if (saveFadeTimer !== 0) clearTimeout(saveFadeTimer);
    void autosave.flush().finally(() => {
      autosave.dispose();
    });
    scroll.dispose();
    world.dispose();
    app.dispose();
    delete dbg.__psgeApp;
    delete dbg.__psgeWorld;
    delete dbg.__psgeScroll;
    delete dbg.__psgeState;
    delete dbg.__psgeSaveStore;
  };
}

try {
  const disposePromise = boot();
  const hot = (
    import.meta as ImportMeta & {
      hot?: { dispose: (cb: () => void) => void };
    }
  ).hot;
  hot?.dispose(() => {
    void disposePromise.then((dispose) => dispose());
  });
  void disposePromise.catch((err) => {
    console.error(err);
    document.documentElement.dataset.psgeError = "true";
  });
} catch (err) {
  console.error(err);
  document.documentElement.dataset.psgeError = "true";
}
