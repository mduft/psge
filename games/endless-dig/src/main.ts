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
import { DirectionalLight, HemisphereLight } from "three";
import { createAutosave } from "./autosave.js";
import { createShaftScroll } from "./cameraScroll.js";
import {
  digCameraFraming,
  fogScaleForCameraDistance,
} from "./digCamera.js";
import { applyDigCursor, digToolOf } from "./digCursor.js";
import { formatAmount, formatMeters } from "./formatAmount.js";
import {
  geoLayerApproachDepths,
  geoLayerAt,
  type GeoLayerId,
} from "./geoLayers.js";
import { focusForDepth } from "./softDig.js";
import {
  buyUpgrade,
  canBuyUpgrade,
  createInitialState,
  dig,
  effectiveDigPowerOf,
  effectivePassiveRateOf,
  resetProgress,
  SHAFT_CROSS_SECTION,
  tickProduction,
  type GameState,
} from "./gameState.js";
import {
  applyHiddenCatchUp,
  claimOfflineReward,
  computeHiddenCatchUp,
  computeOfflineReward,
  formatOfflineDuration,
  type OfflineReward,
} from "./offline.js";
import { DIG_SAVE_KEY, loadGameState, saveGameState } from "./persist.js";
import {
  SHOP_SECTIONS,
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
const LAYER_TOAST_MS = 2800;

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
  /** Force an offline window of this many ms (testing). */
  offlineMs: number;
} {
  const params = new URLSearchParams(window.location.search);
  const nosave =
    params.get("nosave") === "1" || params.get("nosave") === "true";
  const debug =
    params.get("debug") === "1" || params.get("debug") === "true";

  const offlineRaw = params.get("offlineMs");
  const offlineParsed = offlineRaw ? Number.parseInt(offlineRaw, 10) : 0;
  const offlineMs =
    Number.isFinite(offlineParsed) && offlineParsed > 0 ? offlineParsed : 0;

  const raw = params.get("depth");
  if (!raw) {
    return {
      excavatedDepth: 0,
      worldExtent: DEFAULT_WORLD_EXTENT,
      nosave,
      debug,
      offlineMs,
    };
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return {
      excavatedDepth: 0,
      worldExtent: DEFAULT_WORLD_EXTENT,
      nosave,
      debug,
      offlineMs,
    };
  }
  return {
    excavatedDepth: n,
    worldExtent: Math.max(n, DEFAULT_WORLD_EXTENT),
    nosave,
    debug,
    offlineMs,
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

/** Dig power as meters of depth per tap (matches Depth / Auto units). */
function formatDigPower(power: number): string {
  return `${formatMeters(power)} m`;
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
    offlineMs: offlineMsQuery,
  } = readQueryFlags();
  const store = createLocalSaveStore({ key: DIG_SAVE_KEY });
  const wallClock = (): number => Date.now();

  let state: GameState;
  if (nosave) {
    await store.clear();
    state = freshState(depthQuery);
  } else {
    const loaded = await loadGameState(store);
    state = loaded ?? freshState(depthQuery);
  }

  let pendingOffline: OfflineReward | null = null;
  {
    const nowMs = wallClock();
    const lastPlayed =
      offlineMsQuery > 0
        ? nowMs - offlineMsQuery
        : state.lastPlayedAtMs;
    pendingOffline = computeOfflineReward(state, lastPlayed, nowMs);
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
    // Narrow Cursor browser / phone pulls the camera back; scale fog so
    // authored near/far (tuned for ~16:9) still leave the cutaway visible.
    world.setFogDistanceScale(fogScaleForCameraDistance(distance));
  };

  const depthEl = document.querySelector('[data-stat="depth"]');
  const layerEl = document.querySelector('[data-stat="layer"]');
  const dirtEl = document.querySelector('[data-stat="dirt"]');
  const digPowerEl = document.querySelector('[data-stat="dig-power"]');
  const passiveEl = document.querySelector('[data-stat="passive"]');
  const layerToast = document.querySelector<HTMLElement>("#layer-toast");
  const layerToastName = document.querySelector("[data-layer-toast-name]");
  const debugPanel = document.querySelector<HTMLElement>("#debug-panel");

  const hemiLight = app.scene.children.find(
    (c): c is HemisphereLight => c instanceof HemisphereLight,
  );
  const dirLights = app.scene.children.filter(
    (c): c is DirectionalLight => c instanceof DirectionalLight,
  );

  let lastLayerId: GeoLayerId | null = null;
  let layerToastTimer = 0;

  const showLayerToast = (name: string): void => {
    if (!layerToast) return;
    if (layerToastName) layerToastName.textContent = name;
    layerToast.classList.add("is-visible");
    layerToast.setAttribute("aria-hidden", "false");
    if (layerToastTimer !== 0) clearTimeout(layerToastTimer);
    layerToastTimer = window.setTimeout(() => {
      layerToastTimer = 0;
      layerToast.classList.remove("is-visible");
      layerToast.setAttribute("aria-hidden", "true");
    }, LAYER_TOAST_MS);
  };

  const applyLayerMood = (depth: number): void => {
    const layer = geoLayerAt(depth);
    world.applyEnvironment(depth);
    if (hemiLight) {
      hemiLight.color.setHex(layer.mood.hemiSky);
      hemiLight.groundColor.setHex(layer.mood.hemiGround);
      hemiLight.intensity = layer.mood.hemiIntensity;
    }
    if (dirLights[0]) {
      dirLights[0].color.setHex(layer.mood.dirColor);
      dirLights[0].intensity = layer.mood.dirIntensity;
    }
    if (layer.id !== lastLayerId) {
      const prev = lastLayerId;
      lastLayerId = layer.id;
      if (prev !== null) showLayerToast(layer.name);
    }
  };
  const debugFab = document.querySelector<HTMLButtonElement>("#debug-fab");
  const debugClose = document.querySelector<HTMLButtonElement>("#debug-close");
  const debugBackdrop = document.querySelector<HTMLElement>("#debug-backdrop");
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
  const offlineBackdrop = document.querySelector<HTMLElement>(
    "[data-offline-backdrop]",
  );
  const offlineClaim = document.querySelector<HTMLButtonElement>(
    "#offline-claim",
  );
  const offlineDurationEl = document.querySelector("[data-offline-duration]");
  const offlineDepthEl = document.querySelector("[data-offline-depth]");
  const offlineDirtEl = document.querySelector("[data-offline-dirt]");

  const setDebugSheetOpen = (open: boolean): void => {
    if (open) {
      document.documentElement.dataset.psgeShop = "closed";
      shopToggle?.setAttribute("aria-expanded", "false");
      shopBackdrop?.setAttribute("hidden", "");
    }
    document.documentElement.dataset.psgeDebugSheet = open ? "open" : "closed";
    debugFab?.setAttribute("aria-expanded", open ? "true" : "false");
    if (debugBackdrop) {
      if (open) debugBackdrop.removeAttribute("hidden");
      else debugBackdrop.setAttribute("hidden", "");
    }
  };

  const setShopOpen = (open: boolean): void => {
    if (open) setDebugSheetOpen(false);
    document.documentElement.dataset.psgeShop = open ? "open" : "closed";
    shopToggle?.setAttribute("aria-expanded", open ? "true" : "false");
    if (shopBackdrop) {
      if (open) shopBackdrop.removeAttribute("hidden");
      else shopBackdrop.setAttribute("hidden", "");
    }
  };

  setShopOpen(false);
  setDebugSheetOpen(false);

  if (debug) {
    debugPanel?.removeAttribute("hidden");
    debugFab?.removeAttribute("hidden");
    document.documentElement.dataset.psgeDebug = "1";
  } else {
    debugPanel?.setAttribute("hidden", "");
    debugFab?.setAttribute("hidden", "");
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
    getState: () => {
      // Keep the offline clock fresh while playing; freeze it while a claim
      // is pending so a reload still offers the same reward.
      if (!pendingOffline) state.lastPlayedAtMs = wallClock();
      return state;
    },
    onSaved: showSavedIndicator,
  });

  const hideOfflineModal = (): void => {
    offlineBackdrop?.setAttribute("hidden", "");
    document.documentElement.dataset.psgeOffline = "none";
  };

  const showOfflineModal = (reward: OfflineReward): void => {
    if (offlineDurationEl) {
      offlineDurationEl.textContent = formatOfflineDuration(reward.elapsedMs);
    }
    if (offlineDepthEl) {
      offlineDepthEl.textContent = `+${formatMeters(reward.depthGained)} m`;
    }
    if (offlineDirtEl) {
      offlineDirtEl.textContent = `+${formatAmount(reward.dirtGained)}`;
    }
    offlineBackdrop?.removeAttribute("hidden");
    document.documentElement.dataset.psgeOffline = "pending";
    setShopOpen(false);
    setDebugSheetOpen(false);
  };

  const onOfflineClaim = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    if (!pendingOffline) return;
    claimOfflineReward(state, pendingOffline);
    pendingOffline = null;
    state.lastPlayedAtMs = wallClock();
    hideOfflineModal();
    document.documentElement.dataset.psgeOffline = "claimed";
    applyPlayView();
    autosave.markDirty();
    void autosave.flush().catch((err) => console.error(err));
  };
  offlineClaim?.addEventListener("click", onOfflineClaim);
  offlineClaim?.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  offlineBackdrop?.addEventListener("pointerdown", (ev) => ev.stopPropagation());

  const shopButtons = new Map<UpgradeId, HTMLButtonElement>();

  const syncFromState = (): void => {
    ensureExtentForPlay();
    const d = depthNumber(state);
    world.setExcavatedDepth(d);
    world.setFocusBlockY(focusForDepth(d));
  };

  const updateHud = (): void => {
    const depth = depthNumber(state);
    const power = effectiveDigPowerOf(state);
    const passive = effectivePassiveRateOf(state);
    const layer = geoLayerAt(depth);
    if (depthEl) depthEl.textContent = `${formatAmount(state.depth)} m`;
    if (layerEl) layerEl.textContent = layer.name;
    if (dirtEl) dirtEl.textContent = formatAmount(state.dirt);
    if (digPowerEl) digPowerEl.textContent = formatDigPower(power);
    if (passiveEl) {
      passiveEl.textContent = `${formatMeters(passive)} m/s`;
    }
    document.documentElement.dataset.psgeLayer = layer.id;
    applyLayerMood(depth);
    world.syncActors(depth, state.upgrades);

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
    for (const section of SHOP_SECTIONS) {
      const group = document.createElement("section");
      group.className = "shop-section";
      group.dataset.shopSection = section.kind;

      const heading = document.createElement("h3");
      heading.className = "shop-section-title";
      heading.textContent = section.title;
      const hint = document.createElement("p");
      hint.className = "shop-section-hint";
      hint.textContent = section.hint;
      group.append(heading, hint);

      for (const def of UPGRADE_DEFS) {
        if (def.kind !== section.kind) continue;
        const row = document.createElement("div");
        row.className = "shop-row";
        row.dataset.upgrade = def.id;
        row.dataset.upgradeKind = def.kind;

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
        group.append(row);
        shopButtons.set(def.id, buy);
      }
      shopList.append(group);
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
  const onDebugFabToggle = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    setDebugSheetOpen(
      document.documentElement.dataset.psgeDebugSheet !== "open",
    );
  };
  const onDebugSheetClose = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    setDebugSheetOpen(false);
  };
  shopToggle?.addEventListener("click", onShopToggle);
  shopToggle?.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  shopClose?.addEventListener("click", onShopClose);
  shopClose?.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  shopBackdrop?.addEventListener("click", onShopClose);
  shopBackdrop?.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  const shopSheet = document.querySelector<HTMLElement>("#shop-sheet");
  shopSheet?.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  debugFab?.addEventListener("click", onDebugFabToggle);
  debugFab?.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  debugClose?.addEventListener("click", onDebugSheetClose);
  debugClose?.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  debugBackdrop?.addEventListener("click", onDebugSheetClose);
  debugBackdrop?.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  debugPanel?.addEventListener("pointerdown", (ev) => ev.stopPropagation());

  const onGiveDirt = (e: Event): void => {
    const btn = e.currentTarget as HTMLButtonElement;
    const raw = btn.dataset.giveDirt ?? "";
    e.preventDefault();
    e.stopPropagation();
    if (raw === "inf") {
      state.dirt = new Decimal("1e100");
      applyPlayView();
      return;
    }
    const amount = Number.parseFloat(raw);
    if (!Number.isFinite(amount) || amount <= 0) return;
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

  const jumpLayerButtons: HTMLButtonElement[] = [];
  const jumpRow = document.querySelector<HTMLElement>("#debug-layer-jumps");
  if (debug && jumpRow) {
    const shortLabel = (name: string): string => {
      if (name === "Packed clay") return "Clay";
      if (name === "Deep crust") return "Crust";
      if (name === "Ancient rock") return "Ancient";
      if (name === "The Abyss") return "Abyss";
      return name;
    };
    const onJumpLayer = (e: Event): void => {
      const btn = e.currentTarget as HTMLButtonElement;
      const depth = Number.parseFloat(btn.dataset.jumpDepth ?? "");
      if (!Number.isFinite(depth) || depth < 0) return;
      e.preventDefault();
      e.stopPropagation();
      state.depth = new Decimal(depth);
      state.dirt = new Decimal(depth * SHAFT_CROSS_SECTION);
      applyPlayView();
      autosave.markDirty();
    };
    for (const target of geoLayerApproachDepths(5)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hud-reset";
      btn.dataset.jumpDepth = String(target.depth);
      btn.dataset.jumpLayer = target.id;
      btn.title = `${target.name} (−${5} m → ${target.depth} m)`;
      btn.textContent = shortLabel(target.name);
      btn.addEventListener("click", onJumpLayer);
      btn.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      jumpRow.append(btn);
      jumpLayerButtons.push(btn);
    }
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
      world.playDigSwing();
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

  /** Stamp "left at" so tab switches / minimize count as away time. */
  const stampLeftAt = (): void => {
    if (pendingOffline) return;
    state.lastPlayedAtMs = wallClock();
  };

  /**
   * Tab return or resume: ≥30s → offline claim (1/6); shorter → full-rate catch-up.
   * (rAF is paused in background, so without this neither live nor offline ran.)
   */
  const handleReturnFromBackground = (): void => {
    if (pendingOffline) return;
    const nowMs = wallClock();
    const last = state.lastPlayedAtMs;
    const reward = computeOfflineReward(state, last, nowMs);
    if (reward) {
      pendingOffline = reward;
      showOfflineModal(reward);
      return;
    }
    const catchUp = computeHiddenCatchUp(state, last, nowMs);
    if (catchUp) {
      applyHiddenCatchUp(state, catchUp);
      applyPlayView();
      autosave.markDirty();
    }
    state.lastPlayedAtMs = nowMs;
  };

  let pageWasHidden = document.visibilityState === "hidden";
  const onPageHide = (): void => {
    stampLeftAt();
    flushSave();
  };
  const onVisibility = (): void => {
    if (document.visibilityState === "hidden") {
      pageWasHidden = true;
      stampLeftAt();
      flushSave();
      return;
    }
    if (!pageWasHidden) return;
    pageWasHidden = false;
    handleReturnFromBackground();
  };
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", onVisibility);

  applyPlayView();
  if (pendingOffline) showOfflineModal(pendingOffline);
  else {
    hideOfflineModal();
    if (!state.lastPlayedAtMs) {
      state.lastPlayedAtMs = wallClock();
      autosave.markDirty();
    }
  }

  /** Pace subtle passive chips so high rates don't look like tap bursts. */
  let trickleCooldown = 0;
  app.startLoop((dt) => {
    world.update(dt);
    // Pause live auto-dig while the offline claim is open (avoid double-dipping).
    if (pendingOffline) return;
    trickleCooldown = Math.max(0, trickleCooldown - dt);
    if (!tickProduction(state, dt)) return;
    syncFromState();
    applyCamera();
    updateHud();
    autosave.markDirty();
    if (trickleCooldown <= 0) {
      world.trickleDigParticles();
      world.playCrewChip();
      const rate = effectivePassiveRateOf(state);
      // ~3–12 Hz depending on effective passive rate; stays visibly quieter than taps.
      trickleCooldown = Math.min(0.32, Math.max(0.08, 0.28 / Math.sqrt(1 + rate)));
    }
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
  document.documentElement.dataset.psgeMilestone = "6";
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
    debugFab?.removeEventListener("click", onDebugFabToggle);
    debugClose?.removeEventListener("click", onDebugSheetClose);
    debugBackdrop?.removeEventListener("click", onDebugSheetClose);
    offlineClaim?.removeEventListener("click", onOfflineClaim);
    resetButton?.removeEventListener("click", onReset);
    for (const btn of giveDirtButtons) {
      btn.removeEventListener("click", onGiveDirt);
    }
    for (const btn of jumpLayerButtons) {
      btn.remove();
    }
    if (saveFadeTimer !== 0) clearTimeout(saveFadeTimer);
    if (layerToastTimer !== 0) clearTimeout(layerToastTimer);
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
