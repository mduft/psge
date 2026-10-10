/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Tabbed HUD panel (shop / finds / coins / achievements) + debug sheet.
 * Wide: docked under stats rail. Narrow: bottom sheet. Dig while open.
 */

export type HudPanelTab = "shop" | "collection" | "coins" | "achievements";

export interface HudSheetsOptions {
  /** Fired when open state or active tab changes. */
  onChange?: (state: { open: boolean; tab: HudPanelTab }) => void;
}

export interface HudSheets {
  /** Open panel and select a tab (closes debug / help). */
  openTab(tab: HudPanelTab): void;
  setTab(tab: HudPanelTab): void;
  setPanelOpen(open: boolean): void;
  getTab(): HudPanelTab;
  isPanelOpen(): boolean;
  /** Compatibility: open shop tab / close panel. */
  setShopOpen(open: boolean): void;
  setCollectionOpen(open: boolean): void;
  setCoinsOpen(open: boolean): void;
  setAchievementsOpen(open: boolean): void;
  setDebugSheetOpen(open: boolean): void;
  setHelpOpen(open: boolean): void;
  closeAll(): void;
  bind(): () => void;
}

const TABS: readonly HudPanelTab[] = [
  "shop",
  "collection",
  "coins",
  "achievements",
];

function qs<T extends Element>(sel: string): T | null {
  return document.querySelector<T>(sel);
}

function setExpanded(btn: HTMLButtonElement | null, open: boolean): void {
  btn?.setAttribute("aria-expanded", open ? "true" : "false");
}

function setHidden(el: HTMLElement | null, hidden: boolean): void {
  if (!el) return;
  if (hidden) el.setAttribute("hidden", "");
  else el.removeAttribute("hidden");
}

function stopBubble(ev: Event): void {
  ev.stopPropagation();
}

function isTab(v: string | undefined): v is HudPanelTab {
  return (
    v === "shop" ||
    v === "collection" ||
    v === "coins" ||
    v === "achievements"
  );
}

/**
 * One panel shell, tab-switched content. Dataset:
 * - `data-psge-panel` open|closed
 * - `data-psge-panel-tab` shop|collection|coins|achievements
 * Legacy mirrors: psgeShop / Collection / CoinSheet / Achievements = open only
 * when panel is open on that tab (for existing e2e selectors).
 */
export function createHudSheets(options: HudSheetsOptions = {}): HudSheets {
  const panelToggle = qs<HTMLButtonElement>("#panel-toggle");
  const panelClose = qs<HTMLButtonElement>("#panel-close");
  const panelBackdrop = qs<HTMLElement>("#panel-backdrop");
  const panel = qs<HTMLElement>("#hud-panel");

  const debugFab = qs<HTMLButtonElement>("#debug-fab");
  const debugClose = qs<HTMLButtonElement>("#debug-close");
  const debugBackdrop = qs<HTMLElement>("#debug-backdrop");
  const debugPanel = qs<HTMLElement>("#debug-panel");

  const helpFab = qs<HTMLButtonElement>("#help-fab");
  const helpClose = qs<HTMLButtonElement>("#help-close");
  const helpBackdrop = qs<HTMLElement>("#help-backdrop");

  let tab: HudPanelTab = "shop";
  let panelOpen = false;

  const notify = (): void => {
    options.onChange?.({ open: panelOpen, tab });
  };

  const syncLegacyDataset = (): void => {
    const root = document.documentElement.dataset;
    root.psgePanel = panelOpen ? "open" : "closed";
    root.psgePanelTab = tab;
    root.psgeShop =
      panelOpen && tab === "shop" ? "open" : "closed";
    root.psgeCollection =
      panelOpen && tab === "collection" ? "open" : "closed";
    root.psgeCoinSheet =
      panelOpen && tab === "coins" ? "open" : "closed";
    root.psgeAchievements =
      panelOpen && tab === "achievements" ? "open" : "closed";
  };

  const applyTabUi = (): void => {
    for (const id of TABS) {
      const tabBtn = qs<HTMLButtonElement>(`[data-panel-tab="${id}"]`);
      const pane = qs<HTMLElement>(`[data-panel-pane="${id}"]`);
      const selected = id === tab;
      tabBtn?.setAttribute("aria-selected", selected ? "true" : "false");
      tabBtn?.classList.toggle("is-active", selected);
      setHidden(pane, !selected);
    }
  };

  const applyPanelUi = (): void => {
    setExpanded(panelToggle, panelOpen);
    setHidden(panelBackdrop, !panelOpen);
    if (panelToggle) {
      panelToggle.setAttribute(
        "aria-label",
        panelOpen ? "Close panels" : "Open panels",
      );
    }
    applyTabUi();
    syncLegacyDataset();
    notify();
  };

  const setHelpOpen = (open: boolean): void => {
    if (open) {
      panelOpen = false;
      applyPanelUi();
      document.documentElement.dataset.psgeDebugSheet = "closed";
      setExpanded(debugFab, false);
      setHidden(debugBackdrop, true);
    }
    document.documentElement.dataset.psgeHelp = open ? "open" : "closed";
    setExpanded(helpFab, open);
    setHidden(helpBackdrop, !open);
  };

  const setDebugSheetOpen = (open: boolean): void => {
    if (open) {
      panelOpen = false;
      applyPanelUi();
      setHelpOpen(false);
    }
    document.documentElement.dataset.psgeDebugSheet = open ? "open" : "closed";
    setExpanded(debugFab, open);
    setHidden(debugBackdrop, !open);
  };

  const setPanelOpen = (open: boolean): void => {
    if (open) {
      setDebugSheetOpen(false);
      setHelpOpen(false);
    }
    panelOpen = open;
    applyPanelUi();
  };

  const setTab = (next: HudPanelTab): void => {
    tab = next;
    applyTabUi();
    syncLegacyDataset();
    notify();
  };

  const openTab = (next: HudPanelTab): void => {
    tab = next;
    setPanelOpen(true);
  };

  const setShopOpen = (open: boolean): void => {
    if (open) openTab("shop");
    else if (tab === "shop") setPanelOpen(false);
  };
  const setCollectionOpen = (open: boolean): void => {
    if (open) openTab("collection");
    else if (tab === "collection") setPanelOpen(false);
  };
  const setCoinsOpen = (open: boolean): void => {
    if (open) openTab("coins");
    else if (tab === "coins") setPanelOpen(false);
  };
  const setAchievementsOpen = (open: boolean): void => {
    if (open) openTab("achievements");
    else if (tab === "achievements") setPanelOpen(false);
  };

  const closeAll = (): void => {
    setPanelOpen(false);
    setDebugSheetOpen(false);
    setHelpOpen(false);
  };

  const bind = (): (() => void) => {
    const onPanelToggle = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      setPanelOpen(!panelOpen);
    };
    const onPanelClose = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      setPanelOpen(false);
    };
    const onTabClick = (e: Event): void => {
      const btn = (e.target as Element | null)?.closest?.(
        "[data-panel-tab]",
      ) as HTMLElement | null;
      if (!btn) return;
      const id = btn.dataset.panelTab;
      if (!isTab(id)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!panelOpen) openTab(id);
      else setTab(id);
    };
    const onDebugToggle = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      setDebugSheetOpen(
        document.documentElement.dataset.psgeDebugSheet !== "open",
      );
    };
    const onDebugClose = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      setDebugSheetOpen(false);
    };
    const onHelpToggle = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      setHelpOpen(document.documentElement.dataset.psgeHelp !== "open");
    };
    const onHelpClose = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      setHelpOpen(false);
    };
    const onHelpBackdrop = (e: Event): void => {
      if (e.target !== helpBackdrop) return;
      e.preventDefault();
      e.stopPropagation();
      setHelpOpen(false);
    };

    panelToggle?.addEventListener("click", onPanelToggle);
    panelToggle?.addEventListener("pointerdown", stopBubble);
    panelClose?.addEventListener("click", onPanelClose);
    panelClose?.addEventListener("pointerdown", stopBubble);
    panel?.addEventListener("click", onTabClick);
    panel?.addEventListener("pointerdown", stopBubble);

    debugFab?.addEventListener("click", onDebugToggle);
    debugFab?.addEventListener("pointerdown", stopBubble);
    debugClose?.addEventListener("click", onDebugClose);
    debugClose?.addEventListener("pointerdown", stopBubble);
    debugPanel?.addEventListener("pointerdown", stopBubble);

    helpFab?.addEventListener("click", onHelpToggle);
    helpFab?.addEventListener("pointerdown", stopBubble);
    helpClose?.addEventListener("click", onHelpClose);
    helpClose?.addEventListener("pointerdown", stopBubble);
    helpBackdrop?.addEventListener("click", onHelpBackdrop);
    helpBackdrop?.addEventListener("pointerdown", stopBubble);

    applyPanelUi();
    setHelpOpen(false);

    return () => {
      panelToggle?.removeEventListener("click", onPanelToggle);
      panelToggle?.removeEventListener("pointerdown", stopBubble);
      panelClose?.removeEventListener("click", onPanelClose);
      panelClose?.removeEventListener("pointerdown", stopBubble);
      panel?.removeEventListener("click", onTabClick);
      panel?.removeEventListener("pointerdown", stopBubble);

      debugFab?.removeEventListener("click", onDebugToggle);
      debugFab?.removeEventListener("pointerdown", stopBubble);
      debugClose?.removeEventListener("click", onDebugClose);
      debugClose?.removeEventListener("pointerdown", stopBubble);
      debugPanel?.removeEventListener("pointerdown", stopBubble);

      helpFab?.removeEventListener("click", onHelpToggle);
      helpFab?.removeEventListener("pointerdown", stopBubble);
      helpClose?.removeEventListener("click", onHelpClose);
      helpClose?.removeEventListener("pointerdown", stopBubble);
      helpBackdrop?.removeEventListener("click", onHelpBackdrop);
      helpBackdrop?.removeEventListener("pointerdown", stopBubble);
    };
  };

  return {
    openTab,
    setTab,
    setPanelOpen,
    getTab: () => tab,
    isPanelOpen: () => panelOpen,
    setShopOpen,
    setCollectionOpen,
    setCoinsOpen,
    setAchievementsOpen,
    setDebugSheetOpen,
    setHelpOpen,
    closeAll,
    bind,
  };
}
