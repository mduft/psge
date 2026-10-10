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
import {
  initAudio,
  isMuted,
  playCoinAppear,
  toggleMuted,
} from "./audio.js";
import { applyDomIcons, createUiIconImg, uiIconUrl } from "./icons.js";
import {
  startUpdateCheck,
  type VersionManifest,
} from "./updateCheck.js";
import { GAME_VERSION } from "./version.js";
import {
  boosterCoinsCollected,
  boosterComboMult,
  claimAutoBoosters,
  claimTapBooster,
  clearBoosterCombo,
  expireBoosterCombo,
  noteBoosterComboTap,
  type BoosterClaim,
} from "./boosters.js";
import {
  ACHIEVEMENT_DEFS,
  evaluateAchievements,
  getAchievementDef,
  noteAfkDig,
  noteOvernightClaim,
} from "./achievements.js";
import {
  refreshAchievementsList,
  refreshDiscoveryList,
  refreshSpecialCoinsList,
} from "./collectionLists.js";
import {
  resolveDiscoveries,
  unlockNextDiscovery,
} from "./discoveries.js";
import { createFindReveal } from "./findReveal.js";
import { createHudSheets } from "./hudSheets.js";
import {
  hasUnseen,
  markPanelTabSeen,
} from "./panelSeen.js";
import {
  claimAutoSpecialCoins,
  claimTapSpecialCoin,
  SPECIAL_COIN_COUNT,
  unlockNextSpecialCoin,
  type SpecialCoinClaim,
} from "./specialCoins.js";
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
import {
  DIG_SAVE_KEY,
  parseGameState,
  saveGameState,
} from "./persist.js";
import {
  SHOP_SECTIONS,
  UPGRADE_DEFS,
  upgradeCost,
  visibleShopUpgradeIds,
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
const BOOSTER_TOAST_MS = 2200;
const ACHIEVEMENT_TOAST_MS = 2400;
const FIND_AUTO_CLOSE_MS = 5000;

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

function freshState(excavatedDepth: number): {
  state: GameState;
  found: string[];
} {
  const state = createInitialState({
    depth: excavatedDepth,
    dirt: excavatedDepth * SHAFT_CROSS_SECTION,
  });
  const found =
    excavatedDepth > 0
      ? resolveDiscoveries(state.discoveries, 0, excavatedDepth).newlyUnlocked
      : [];
  return { state, found };
}

/**
 * Block boot until the player chooses Reset. Reload keeps the blob and
 * refreshes the page (for picking up a fixed build).
 */
function waitForSaveErrorReset(): Promise<void> {
  const backdrop = document.querySelector<HTMLElement>("#save-error-backdrop");
  const reloadBtn = document.querySelector<HTMLButtonElement>(
    "#save-error-reload",
  );
  const resetBtn = document.querySelector<HTMLButtonElement>(
    "#save-error-reset",
  );
  if (!backdrop || !reloadBtn || !resetBtn) {
    throw new Error("Expected #save-error-backdrop UI");
  }
  return new Promise((resolve) => {
    document.documentElement.dataset.psgeSaveError = "1";
    backdrop.hidden = false;
    const onReload = (): void => {
      location.reload();
    };
    const onReset = (): void => {
      reloadBtn.removeEventListener("click", onReload);
      resetBtn.removeEventListener("click", onReset);
      backdrop.hidden = true;
      document.documentElement.dataset.psgeSaveError = "0";
      resolve();
    };
    reloadBtn.addEventListener("click", onReload);
    resetBtn.addEventListener("click", onReset);
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
  // Wire `<img data-icon>` slots — swap PNGs under assets/textures/icons/.
  applyDomIcons();
  initAudio();
  const muteFab = document.querySelector<HTMLButtonElement>("#mute-fab");
  const applyMuteUi = (): void => {
    const muted = isMuted();
    document.documentElement.dataset.psgeMuted = muted ? "1" : "0";
    if (!muteFab) return;
    muteFab.setAttribute("aria-pressed", muted ? "true" : "false");
    muteFab.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
    muteFab.title = muted ? "Unmute sound" : "Mute sound";
  };
  applyMuteUi();
  const onMuteToggle = (): void => {
    toggleMuted();
    applyMuteUi();
  };
  muteFab?.addEventListener("click", onMuteToggle);
  muteFab?.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  const gameVersionEl = document.querySelector("[data-game-version]");
  if (gameVersionEl) gameVersionEl.textContent = `v${GAME_VERSION}`;

  const updateBanner = document.querySelector<HTMLElement>("#update-banner");
  const updateVersionEl = document.querySelector<HTMLElement>(
    "[data-update-version]",
  );
  const updateReload = document.querySelector<HTMLButtonElement>(
    "#update-reload",
  );
  const updateDismiss = document.querySelector<HTMLButtonElement>(
    "#update-dismiss",
  );
  const showUpdateBanner = (remote: VersionManifest): void => {
    if (updateVersionEl) {
      updateVersionEl.textContent = `v${remote.version}`;
      updateVersionEl.hidden = false;
    }
    if (updateBanner) updateBanner.hidden = false;
    document.documentElement.dataset.psgeUpdate = "1";
  };
  const hideUpdateBanner = (): void => {
    if (updateBanner) updateBanner.hidden = true;
    delete document.documentElement.dataset.psgeUpdate;
  };
  const onUpdateReload = (): void => {
    location.reload();
  };
  const onUpdateDismiss = (): void => {
    hideUpdateBanner();
  };
  updateReload?.addEventListener("click", onUpdateReload);
  updateDismiss?.addEventListener("click", onUpdateDismiss);
  const updateCheck = startUpdateCheck({
    localBuildId: __PSGE_BUILD_ID__,
    onUpdateAvailable: showUpdateBanner,
  });

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
  let bootFinds: string[] = [];
  if (nosave) {
    await store.clear();
    ({ state, found: bootFinds } = freshState(depthQuery));
  } else {
    const raw = await store.load();
    const loaded = parseGameState(raw);
    if (loaded) {
      state = loaded;
    } else if (raw != null) {
      console.error(
        "[psge] Save present but could not be parsed; waiting for Reload or Reset.",
      );
      await waitForSaveErrorReset();
      await store.clear();
      ({ state, found: bootFinds } = freshState(depthQuery));
    } else {
      ({ state, found: bootFinds } = freshState(depthQuery));
    }
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
    // Aim a little above the dig face so the digger sits lower and more shaft
    // (coins) stays on-screen above them — halfway between the old aim and a
    // stronger tilt.
    const yLift = 8.75;
    const lookAboveFocus = 1.25;
    const focusY = world.getRenderFocusY();

    app.setCamera({
      position: [xOffset * BLOCK_SCALE + panX, focusY + yLift, distance],
      lookAt: [panX, focusY + lookAboveFocus, -6 * BLOCK_SCALE],
    });
    // Narrow Cursor browser / phone pulls the camera back; scale fog so
    // authored near/far (tuned for ~16:9) still leave the cutaway visible.
    world.setFogDistanceScale(fogScaleForCameraDistance(distance));
  };

  const depthEl = document.querySelector('[data-stat="depth"]');
  const layerPlate = document.querySelector<HTMLElement>("[data-layer-plate]");
  const layerPlateName = document.querySelector("[data-layer-plate-name]");
  const dirtEl = document.querySelector('[data-stat="dirt"]');
  const digPowerEl = document.querySelector('[data-stat="dig-power"]');
  const passiveEl = document.querySelector('[data-stat="passive"]');
  const autoPauseBtn =
    document.querySelector<HTMLButtonElement>("#auto-pause");
  const autoStat = document.querySelector<HTMLElement>(".stat-auto");
  const collectionBoostersEl = document.querySelector<HTMLElement>(
    "[data-collection-boosters]",
  );
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
  const debugScroll = document.querySelector<HTMLInputElement>("#debug-scroll");
  const shopList = document.querySelector<HTMLElement>("#shop-list");
  const panelToggle =
    document.querySelector<HTMLButtonElement>("#panel-toggle");
  const shopAffordDot =
    document.querySelector<HTMLElement>("[data-shop-afford]");
  const shopAffordTab =
    document.querySelector<HTMLElement>("[data-shop-afford-tab]");
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

  const collectionList =
    document.querySelector<HTMLElement>("#collection-list");
  const collectionNewEl = document.querySelector<HTMLElement>(
    "[data-collection-new]",
  );
  const coinsList = document.querySelector<HTMLElement>("#coins-list");
  const coinsNewEl = document.querySelector<HTMLElement>("[data-coins-new]");
  const coinsProgressEl = document.querySelector<HTMLElement>(
    "[data-coins-progress]",
  );
  const achievementsList = document.querySelector<HTMLElement>(
    "#achievements-list",
  );
  const achievementsNewEl = document.querySelector<HTMLElement>(
    "[data-achievements-new]",
  );
  const achievementsProgressEl = document.querySelector<HTMLElement>(
    "[data-achievements-progress]",
  );

  const setTabNewDot = (el: HTMLElement | null, show: boolean): void => {
    if (!el) return;
    if (show) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  };

  const syncPanelNewDots = (): void => {
    const findsNew = hasUnseen(
      state.discoveries.unlocked,
      state.panelSeen.discoveries,
    );
    const coinsNew = hasUnseen(
      state.specialCoins.unlocked,
      state.panelSeen.specialCoins,
    );
    const goalsNew = hasUnseen(
      state.achievements.unlocked,
      state.panelSeen.achievements,
    );
    setTabNewDot(collectionNewEl, findsNew);
    setTabNewDot(coinsNewEl, coinsNew);
    setTabNewDot(achievementsNewEl, goalsNew);
    document.documentElement.dataset.psgeCollectionNew = findsNew ? "1" : "0";
    document.documentElement.dataset.psgeCoinsNew = coinsNew ? "1" : "0";
    document.documentElement.dataset.psgeAchievementsNew = goalsNew
      ? "1"
      : "0";
  };

  let markPanelSeenDirty: () => void = () => {};
  const sheets = createHudSheets({
    onChange: ({ open, tab }) => {
      if (open && markPanelTabSeen(state, tab)) {
        markPanelSeenDirty();
      }
      syncPanelNewDots();
    },
  });
  sheets.closeAll();
  const unbindSheets = sheets.bind();
  // Wide: keep the tabbed dock open under the stats rail by default.
  if (window.matchMedia("(min-width: 521px)").matches) {
    sheets.openTab("shop");
  }

  const findReveal = createFindReveal({
    autoCloseMs: FIND_AUTO_CLOSE_MS,
    isBlocked: () => pendingOffline !== null,
  });

  const boosterToast = document.querySelector<HTMLElement>("#booster-toast");
  const boosterToastEyebrow = document.querySelector(
    "[data-booster-toast-eyebrow]",
  );
  const boosterToastCombo = document.querySelector<HTMLElement>(
    "[data-booster-toast-combo]",
  );
  const boosterToastName = document.querySelector("[data-booster-toast-name]");
  let boosterToastTimer = 0;
  const achievementToast = document.querySelector<HTMLElement>(
    "#achievement-toast",
  );
  const achievementToastName = document.querySelector(
    "[data-achievement-toast-name]",
  );
  let achievementToastTimer = 0;
  const achievementToastQueue: string[] = [];
  let achievementToastShowing = false;
  /** Last canvas pointer in CSS pixels relative to canvas (for NDC pick). */
  let lastPointer = { x: 0.5, y: 0.5 };
  /** Fine pointer: swap to pointer cursor while hovering a shaft coin. */
  const coarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  let hoveringCoin = false;

  const restoreDigCursor = (): void => {
    applyDigCursor(canvas, digToolOf(state.upgrades));
  };

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
  markPanelSeenDirty = () => autosave.markDirty();

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
    sheets.closeAll();
  };

  const enqueueFinds = (ids: string[]): void => {
    findReveal.enqueueDiscoveries(ids);
  };

  const enqueueSpecialClaims = (claims: SpecialCoinClaim[]): void => {
    if (claims.length === 0) return;
    for (const c of claims) {
      if (c.dirt > 0) state.dirt = state.dirt.plus(c.dirt);
    }
    findReveal.enqueueSpecialClaims(claims);
  };

  const pumpAchievementToast = (): void => {
    if (achievementToastShowing || achievementToastQueue.length === 0) return;
    const id = achievementToastQueue.shift()!;
    const def = getAchievementDef(id);
    if (!achievementToast || !def) {
      pumpAchievementToast();
      return;
    }
    if (achievementToastName) achievementToastName.textContent = def.name;
    // Retrigger confetti / trophy pop even when toasts queue back-to-back.
    achievementToast.classList.remove("is-visible");
    void achievementToast.offsetWidth;
    achievementToast.classList.add("is-visible");
    achievementToast.setAttribute("aria-hidden", "false");
    document.documentElement.dataset.psgeAchievement = id;
    achievementToastShowing = true;
    if (achievementToastTimer !== 0) clearTimeout(achievementToastTimer);
    achievementToastTimer = window.setTimeout(() => {
      achievementToastTimer = 0;
      achievementToast.classList.remove("is-visible");
      achievementToast.setAttribute("aria-hidden", "true");
      achievementToastShowing = false;
      pumpAchievementToast();
    }, ACHIEVEMENT_TOAST_MS);
  };

  const enqueueAchievementToasts = (ids: string[]): void => {
    if (ids.length === 0) return;
    achievementToastQueue.push(...ids);
    pumpAchievementToast();
  };

  /** Evaluate unlocks; toast newly earned; returns whether any unlocked. */
  const flushAchievements = (): boolean => {
    const newly = evaluateAchievements(state);
    if (newly.length === 0) return false;
    enqueueAchievementToasts(newly);
    return true;
  };

  const formatTapMult = (mult: number): string => {
    const rounded = Math.round(mult * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };

  const showBoosterToast = (claims: BoosterClaim[]): void => {
    if (!boosterToast || claims.length === 0) return;
    const dirt = claims.reduce((s, c) => s + c.dirt, 0);
    const tapped = claims.filter((c) => c.via === "tap");
    const lastTap = tapped[tapped.length - 1];
    const combo = lastTap?.combo ?? 0;
    const comboMult = combo > 0 ? boosterComboMult(combo) : 1;
    const mult = lastTap?.mult ?? 1;
    const intensity = Math.min(12, Math.max(0, combo));

    boosterToast.dataset.combo = String(intensity);
    boosterToast.style.setProperty("--combo", String(intensity));

    if (boosterToastEyebrow) {
      if (lastTap) {
        boosterToastEyebrow.textContent = `Dirt coin · tap ×${formatTapMult(mult)}`;
      } else {
        boosterToastEyebrow.textContent =
          claims.length > 1
            ? `Dirt coins ×${claims.length}`
            : "Dirt coin";
      }
    }
    if (boosterToastCombo) {
      if (combo > 1) {
        boosterToastCombo.hidden = false;
        boosterToastCombo.textContent = `COMBO ${combo} · ×${formatTapMult(comboMult)}`;
      } else {
        boosterToastCombo.hidden = true;
        boosterToastCombo.textContent = "";
      }
    }
    if (boosterToastName) {
      boosterToastName.textContent = `+${formatAmount(dirt)} dirt`;
    }

    // Retrigger enter / combo pop when stacking pickups quickly.
    boosterToast.classList.remove("is-visible", "has-combo-pop");
    void boosterToast.offsetWidth;
    boosterToast.classList.add("is-visible");
    if (combo > 1) boosterToast.classList.add("has-combo-pop");
    boosterToast.setAttribute("aria-hidden", "false");

    const holdMs =
      BOOSTER_TOAST_MS + Math.min(900, Math.max(0, combo - 1) * 120);
    if (boosterToastTimer !== 0) clearTimeout(boosterToastTimer);
    boosterToastTimer = window.setTimeout(() => {
      boosterToastTimer = 0;
      boosterToast.classList.remove("is-visible", "has-combo-pop");
      boosterToast.setAttribute("aria-hidden", "true");
      boosterToast.dataset.combo = "0";
      boosterToast.style.setProperty("--combo", "0");
      if (boosterToastCombo) {
        boosterToastCombo.hidden = true;
        boosterToastCombo.textContent = "";
      }
    }, holdMs);
  };

  const applyBoosterClaims = (claims: BoosterClaim[]): void => {
    if (claims.length === 0) return;
    for (const c of claims) {
      state.dirt = state.dirt.plus(c.dirt);
    }
    showBoosterToast(claims);
    document.documentElement.dataset.psgeBooster = claims[claims.length - 1]!.id;
  };

  const collectAutoBoosters = (): void => {
    const claims = claimAutoBoosters(
      state.boosters,
      state.discoveries.worldSeed,
      depthNumber(state),
    );
    if (claims.length > 0) clearBoosterCombo(state.boosters);
    applyBoosterClaims(claims);
  };

  const collectAutoSpecialCoins = (): void => {
    enqueueSpecialClaims(
      claimAutoSpecialCoins(
        state.specialCoins,
        state.discoveries.worldSeed,
        depthNumber(state),
      ),
    );
  };

  const collectShaftCoins = (): void => {
    collectAutoBoosters();
    collectAutoSpecialCoins();
  };

  const pointerToCanvas = (e: PointerEvent): boolean => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    lastPointer = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
    return true;
  };

  const clearCoinHover = (): void => {
    if (!hoveringCoin) {
      world.setShaftCoinHover(null);
      return;
    }
    hoveringCoin = false;
    world.setShaftCoinHover(null);
    if (!coarsePointer) restoreDigCursor();
  };

  const refreshCoinHover = (): void => {
    if (pendingOffline || findReveal.isOpen) {
      clearCoinHover();
      return;
    }
    const ndcX = lastPointer.x * 2 - 1;
    const ndcY = -(lastPointer.y * 2 - 1);
    const hit = world.pickShaftCoin(app.camera, ndcX, ndcY);
    world.setShaftCoinHover(hit);
    const next = hit !== null;
    if (next === hoveringCoin) {
      if (next && !coarsePointer) canvas.style.cursor = "pointer";
      return;
    }
    hoveringCoin = next;
    if (!coarsePointer) {
      if (next) canvas.style.cursor = "pointer";
      else restoreDigCursor();
    }
  };

  const onCanvasPointerDown = (e: PointerEvent): void => {
    if (!pointerToCanvas(e)) return;
    refreshCoinHover();
  };
  const onCanvasPointerMove = (e: PointerEvent): void => {
    if (!pointerToCanvas(e)) return;
    refreshCoinHover();
  };
  const onCanvasPointerLeave = (): void => {
    clearCoinHover();
  };
  canvas.addEventListener("pointerdown", onCanvasPointerDown);
  canvas.addEventListener("pointermove", onCanvasPointerMove);
  canvas.addEventListener("pointerleave", onCanvasPointerLeave);

  const onAutoPauseToggle = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    state.autoDigPaused = !state.autoDigPaused;
    updateHud();
    autosave.markDirty();
  };
  autoPauseBtn?.addEventListener("click", onAutoPauseToggle);
  autoPauseBtn?.addEventListener("pointerdown", (ev) => ev.stopPropagation());

  const onOfflineClaim = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    if (!pendingOffline) return;
    const found = claimOfflineReward(state, pendingOffline);
    pendingOffline = null;
    state.lastPlayedAtMs = wallClock();
    noteOvernightClaim(state);
    hideOfflineModal();
    document.documentElement.dataset.psgeOffline = "claimed";
    enqueueFinds(found);
    collectShaftCoins();
    applyPlayView();
    // Offline claim closes the dock; restore it on wide so tabs stay handy.
    if (window.matchMedia("(min-width: 521px)").matches) {
      sheets.setPanelOpen(true);
    }
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
    if (layerPlateName) layerPlateName.textContent = layer.name;
    if (layerPlate) layerPlate.dataset.layer = layer.id;
    if (dirtEl) dirtEl.textContent = formatAmount(state.dirt);
    const coinCount = boosterCoinsCollected(state.boosters);
    const coinDirt = state.boosters.dirtEarned;
    if (collectionBoostersEl) {
      collectionBoostersEl.textContent =
        coinCount === 0
          ? "No dirt coins yet — dig to find them in the shaft."
          : `Dirt coins ${coinCount} · dirt from coins ${formatAmount(coinDirt)}`;
    }
    const specialCount = state.specialCoins.unlocked.length;
    if (coinsProgressEl) {
      coinsProgressEl.textContent =
        specialCount === 0
          ? `0 / ${SPECIAL_COIN_COUNT} — sparse finds in the shaft`
          : `${specialCount} / ${SPECIAL_COIN_COUNT} collected`;
    }
    if (digPowerEl) digPowerEl.textContent = formatDigPower(power);
    if (passiveEl) {
      // Keep the rate visible while paused — the button icon/color carries state.
      passiveEl.textContent = `${formatMeters(passive)} m/s`;
    }
    if (autoPauseBtn) {
      if (passive > 0 || state.autoDigPaused) {
        autoPauseBtn.hidden = false;
        autoPauseBtn.setAttribute(
          "aria-pressed",
          state.autoDigPaused ? "true" : "false",
        );
        autoPauseBtn.setAttribute(
          "aria-label",
          state.autoDigPaused ? "Resume auto-dig" : "Pause auto-dig",
        );
        autoPauseBtn.title = state.autoDigPaused
          ? "Resume auto-dig"
          : "Pause auto-dig to grab coins";
      } else {
        autoPauseBtn.hidden = true;
      }
    }
    autoStat?.classList.toggle("is-paused", state.autoDigPaused);
    document.documentElement.dataset.psgeAutoPaused = state.autoDigPaused
      ? "1"
      : "0";
    document.documentElement.dataset.psgeLayer = layer.id;
    document.documentElement.dataset.psgeDiscoveries = String(
      state.discoveries.unlocked.length,
    );
    document.documentElement.dataset.psgeCoins = String(coinCount);
    document.documentElement.dataset.psgeCoinDirt = String(coinDirt);
    document.documentElement.dataset.psgeSpecialCoins = String(specialCount);
    applyLayerMood(depth);
    world.syncActors(depth, state.upgrades);
    world.syncMineshafts(depth);
    const coinsAppeared = world.syncShaftCoins(
      depth,
      state.discoveries.worldSeed,
      state.boosters,
      state.specialCoins,
    );
    if (coinsAppeared > 0) playCoinAppear();
    // Viewing a catalog tab clears its new-dot (including unlocks while open).
    if (sheets.isPanelOpen() && markPanelTabSeen(state, sheets.getTab())) {
      autosave.markDirty();
    }
    refreshDiscoveryList(collectionList, state.discoveries.unlocked);
    refreshSpecialCoinsList(coinsList, state.specialCoins.unlocked);
    const achCount = state.achievements.unlocked.length;
    if (achievementsProgressEl) {
      achievementsProgressEl.textContent =
        achCount === 0
          ? `0 / ${ACHIEVEMENT_DEFS.length} — keep digging`
          : `${achCount} / ${ACHIEVEMENT_DEFS.length} unlocked`;
    }
    refreshAchievementsList(achievementsList, state.achievements.unlocked);
    document.documentElement.dataset.psgeAchievementsCount = String(achCount);
    syncPanelNewDots();

    const visibleUpgrades = visibleShopUpgradeIds(state.upgrades, state.dirt);
    let anyAffordable = false;
    for (const def of UPGRADE_DEFS) {
      const level = state.upgrades[def.id];
      const cost = upgradeCost(def.id, level);
      const affordable = canBuyUpgrade(state, def.id);
      if (affordable) anyAffordable = true;
      const row = shopList?.querySelector<HTMLElement>(
        `[data-upgrade="${def.id}"]`,
      );
      const visible = visibleUpgrades.has(def.id);
      if (row) {
        row.hidden = !visible;
        row.dataset.shopVisible = visible ? "1" : "0";
        row.classList.toggle("is-owned", level > 0);
        row.classList.toggle("is-locked", level === 0);
        row.classList.toggle("is-affordable", affordable);
      }
      const effect = shopList?.querySelector(`[data-shop-effect="${def.id}"]`);
      if (effect) {
        effect.textContent = `Lv ${level} · ${def.effectLabel} · ${formatAmount(cost)} dirt`;
      }
      const buy = shopButtons.get(def.id);
      if (buy) {
        const action = level === 0 ? "unlock" : "upgrade";
        if (buy.dataset.shopAction !== action) {
          buy.dataset.shopAction = action;
          const label = action === "unlock" ? "Unlock" : "Upgrade";
          buy.setAttribute("aria-label", `${label} ${def.name}`);
          buy.title = label;
          const icon = buy.querySelector<HTMLImageElement>("img[data-icon]");
          if (icon) {
            const iconId = action === "unlock" ? "shop-unlock" : "shop-upgrade";
            icon.dataset.icon = iconId;
            icon.src = uiIconUrl(iconId);
          }
        }
        buy.disabled = !affordable;
      }
    }
    if (shopAffordDot) {
      if (anyAffordable) shopAffordDot.removeAttribute("hidden");
      else shopAffordDot.setAttribute("hidden", "");
    }
    if (shopAffordTab) {
      if (anyAffordable) shopAffordTab.removeAttribute("hidden");
      else shopAffordTab.setAttribute("hidden", "");
    }
    panelToggle?.classList.toggle("has-affordable", anyAffordable);

    document.documentElement.dataset.psgeDepth = state.depth.toString();
    document.documentElement.dataset.psgeDirt = state.dirt.toString();
    document.documentElement.dataset.psgeDigPower = power.toString();
    if (hoveringCoin && !coarsePointer) canvas.style.cursor = "pointer";
    else restoreDigCursor();
  };

  const applyPlayView = (): void => {
    syncFromState();
    applyCamera();
    if (flushAchievements()) autosave.markDirty();
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
      const sectionHeader = document.createElement("header");
      sectionHeader.className = "shop-section-header";
      sectionHeader.append(heading, hint);
      group.append(sectionHeader);

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
        buy.append(createUiIconImg("shop-unlock", "psge-icon shop-buy-icon"));
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
      const before = depthNumber(state);
      state.depth = new Decimal(depth);
      state.dirt = new Decimal(depth * SHAFT_CROSS_SECTION);
      if (depth > before) {
        enqueueFinds(
          resolveDiscoveries(state.discoveries, before, depth).newlyUnlocked,
        );
      }
      collectShaftCoins();
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

  const unlockFindBtn = document.querySelector<HTMLButtonElement>(
    "#debug-unlock-find",
  );
  if (debug && unlockFindBtn) {
    const onUnlockFind = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      const id = unlockNextDiscovery(state.discoveries);
      if (!id) return;
      enqueueFinds([id]);
      applyPlayView();
      autosave.markDirty();
    };
    unlockFindBtn.addEventListener("click", onUnlockFind);
    unlockFindBtn.addEventListener("pointerdown", (ev) =>
      ev.stopPropagation(),
    );
  }

  const unlockCoinBtn = document.querySelector<HTMLButtonElement>(
    "#debug-unlock-coin",
  );
  if (debug && unlockCoinBtn) {
    const onUnlockCoin = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      const id = unlockNextSpecialCoin(state.specialCoins);
      if (!id) return;
      enqueueSpecialClaims([{ id, dirt: 0, via: "auto" }]);
      applyPlayView();
      autosave.markDirty();
    };
    unlockCoinBtn.addEventListener("click", onUnlockCoin);
    unlockCoinBtn.addEventListener("pointerdown", (ev) =>
      ev.stopPropagation(),
    );
  }

  const scroll = createShaftScroll({
    world,
    canvas,
    applyCamera,
    onFocusBlockY: updateHud,
    // Drag-scroll is debug-only and off by default (opt in via checkbox).
    scrollEnabled: false,
    onTap: () => {
      if (pendingOffline || findReveal.isOpen) return;
      const ndcX = lastPointer.x * 2 - 1;
      const ndcY = -(lastPointer.y * 2 - 1);
      const hit = world.pickShaftCoin(app.camera, ndcX, ndcY);
      const depth = depthNumber(state);
      const seed = state.discoveries.worldSeed;
      if (hit?.kind === "dirt") {
        const now = Date.now();
        expireBoosterCombo(state.boosters, now);
        const streak = state.boosters.combo + 1;
        const claim = claimTapBooster(
          state.boosters,
          seed,
          depth,
          hit.id,
          streak,
        );
        if (claim) {
          noteBoosterComboTap(state.boosters, streak, now);
          applyBoosterClaims([claim]);
          applyPlayView();
          autosave.markDirty();
          return;
        }
      } else if (hit?.kind === "special") {
        const claim = claimTapSpecialCoin(
          state.specialCoins,
          seed,
          depth,
          hit.id,
        );
        if (claim) {
          enqueueSpecialClaims([claim]);
          applyPlayView();
          autosave.markDirty();
          return;
        }
      }
      const found = dig(state);
      document.documentElement.dataset.psgeDigIntent = "1";
      enqueueFinds(found);
      collectShaftCoins();
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
      enqueueFinds(applyHiddenCatchUp(state, catchUp));
      collectShaftCoins();
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
  findReveal.hide();
  if (pendingOffline) showOfflineModal(pendingOffline);
  else {
    hideOfflineModal();
    if (!state.lastPlayedAtMs) {
      state.lastPlayedAtMs = wallClock();
      autosave.markDirty();
    }
    enqueueFinds(bootFinds);
    collectShaftCoins();
    applyPlayView();
  }

  /** Pace subtle passive chips so high rates don't look like tap bursts. */
  let trickleCooldown = 0;
  app.startLoop((dt) => {
    world.update(dt);
    // Pause live auto-dig while claim / find reveal is open, or player paused.
    if (pendingOffline || findReveal.isOpen || state.autoDigPaused) return;
    trickleCooldown = Math.max(0, trickleCooldown - dt);
    const depthBefore = depthNumber(state);
    const found = tickProduction(state, dt);
    if (depthNumber(state) === depthBefore) return;
    noteAfkDig(state);
    enqueueFinds(found);
    collectShaftCoins();
    syncFromState();
    applyCamera();
    if (flushAchievements()) autosave.markDirty();
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
  document.documentElement.dataset.psgeMilestone = "9";
  document.documentElement.dataset.psgeVersion = GAME_VERSION;
  document.documentElement.dataset.psgeWorldExtent = String(
    world.getWorldExtent(),
  );
  document.documentElement.dataset.psgeNosave = nosave ? "1" : "0";
  updateHud();

  return () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVisibility);
    unbindSheets();
    findReveal.dispose();
    offlineClaim?.removeEventListener("click", onOfflineClaim);
    canvas.removeEventListener("pointerdown", onCanvasPointerDown);
    canvas.removeEventListener("pointermove", onCanvasPointerMove);
    canvas.removeEventListener("pointerleave", onCanvasPointerLeave);
    world.setShaftCoinHover(null);
    autoPauseBtn?.removeEventListener("click", onAutoPauseToggle);
    muteFab?.removeEventListener("click", onMuteToggle);
    updateReload?.removeEventListener("click", onUpdateReload);
    updateDismiss?.removeEventListener("click", onUpdateDismiss);
    updateCheck.dispose();
    resetButton?.removeEventListener("click", onReset);
    for (const btn of giveDirtButtons) {
      btn.removeEventListener("click", onGiveDirt);
    }
    for (const btn of jumpLayerButtons) {
      btn.remove();
    }
    if (saveFadeTimer !== 0) clearTimeout(saveFadeTimer);
    if (layerToastTimer !== 0) clearTimeout(layerToastTimer);
    if (boosterToastTimer !== 0) clearTimeout(boosterToastTimer);
    if (achievementToastTimer !== 0) clearTimeout(achievementToastTimer);
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
