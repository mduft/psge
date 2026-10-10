/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * FAB sheet open/close mutex (shop / finds / special coins / debug).
 */

export type HudSheetId = "shop" | "collection" | "coins" | "debug";

export interface HudSheets {
  setShopOpen(open: boolean): void;
  setCollectionOpen(open: boolean): void;
  setCoinsOpen(open: boolean): void;
  setDebugSheetOpen(open: boolean): void;
  closeAll(): void;
  /** Wire FAB / close / sheet pointer listeners; returns disposer. */
  bind(): () => void;
}

function qs<T extends Element>(sel: string): T | null {
  return document.querySelector<T>(sel);
}

function setExpanded(
  btn: HTMLButtonElement | null,
  open: boolean,
): void {
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

/**
 * Query DOM once and own sheet open-state + listeners.
 * Backdrops are visual-only (`pointer-events: none`) — no click-to-close.
 */
export function createHudSheets(): HudSheets {
  const shopToggle = qs<HTMLButtonElement>("#shop-toggle");
  const shopClose = qs<HTMLButtonElement>("#shop-close");
  const shopBackdrop = qs<HTMLElement>("#shop-backdrop");
  const shopSheet = qs<HTMLElement>("#shop-sheet");

  const collectionToggle = qs<HTMLButtonElement>("#collection-toggle");
  const collectionClose = qs<HTMLButtonElement>("#collection-close");
  const collectionBackdrop = qs<HTMLElement>("#collection-backdrop");
  const collectionSheet = qs<HTMLElement>("#collection-sheet");

  const coinsToggle = qs<HTMLButtonElement>("#coins-toggle");
  const coinsClose = qs<HTMLButtonElement>("#coins-close");
  const coinsBackdrop = qs<HTMLElement>("#coins-backdrop");
  const coinsSheet = qs<HTMLElement>("#coins-sheet");

  const debugFab = qs<HTMLButtonElement>("#debug-fab");
  const debugClose = qs<HTMLButtonElement>("#debug-close");
  const debugBackdrop = qs<HTMLElement>("#debug-backdrop");
  const debugPanel = qs<HTMLElement>("#debug-panel");

  const setDebugSheetOpen = (open: boolean): void => {
    if (open) {
      document.documentElement.dataset.psgeShop = "closed";
      document.documentElement.dataset.psgeCollection = "closed";
      document.documentElement.dataset.psgeCoinSheet = "closed";
      setExpanded(shopToggle, false);
      setExpanded(collectionToggle, false);
      setExpanded(coinsToggle, false);
      setHidden(shopBackdrop, true);
      setHidden(collectionBackdrop, true);
      setHidden(coinsBackdrop, true);
    }
    document.documentElement.dataset.psgeDebugSheet = open ? "open" : "closed";
    setExpanded(debugFab, open);
    setHidden(debugBackdrop, !open);
  };

  const setCoinsOpen = (open: boolean): void => {
    if (open) {
      setDebugSheetOpen(false);
      document.documentElement.dataset.psgeShop = "closed";
      document.documentElement.dataset.psgeCollection = "closed";
      setExpanded(shopToggle, false);
      setExpanded(collectionToggle, false);
      setHidden(shopBackdrop, true);
      setHidden(collectionBackdrop, true);
    }
    document.documentElement.dataset.psgeCoinSheet = open ? "open" : "closed";
    setExpanded(coinsToggle, open);
    setHidden(coinsBackdrop, !open);
  };

  const setCollectionOpen = (open: boolean): void => {
    if (open) {
      setDebugSheetOpen(false);
      document.documentElement.dataset.psgeShop = "closed";
      document.documentElement.dataset.psgeCoinSheet = "closed";
      setExpanded(shopToggle, false);
      setExpanded(coinsToggle, false);
      setHidden(shopBackdrop, true);
      setHidden(coinsBackdrop, true);
    }
    document.documentElement.dataset.psgeCollection = open
      ? "open"
      : "closed";
    setExpanded(collectionToggle, open);
    setHidden(collectionBackdrop, !open);
  };

  const setShopOpen = (open: boolean): void => {
    if (open) {
      setDebugSheetOpen(false);
      setCollectionOpen(false);
      setCoinsOpen(false);
    }
    document.documentElement.dataset.psgeShop = open ? "open" : "closed";
    setExpanded(shopToggle, open);
    setHidden(shopBackdrop, !open);
  };

  const closeAll = (): void => {
    setShopOpen(false);
    setCollectionOpen(false);
    setCoinsOpen(false);
    setDebugSheetOpen(false);
  };

  const bind = (): (() => void) => {
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
    const onCollectionToggle = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      setCollectionOpen(
        document.documentElement.dataset.psgeCollection !== "open",
      );
    };
    const onCollectionClose = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      setCollectionOpen(false);
    };
    const onCoinsToggle = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      setCoinsOpen(document.documentElement.dataset.psgeCoinSheet !== "open");
    };
    const onCoinsClose = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      setCoinsOpen(false);
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

    shopToggle?.addEventListener("click", onShopToggle);
    shopToggle?.addEventListener("pointerdown", stopBubble);
    shopClose?.addEventListener("click", onShopClose);
    shopClose?.addEventListener("pointerdown", stopBubble);
    shopSheet?.addEventListener("pointerdown", stopBubble);

    collectionToggle?.addEventListener("click", onCollectionToggle);
    collectionToggle?.addEventListener("pointerdown", stopBubble);
    collectionClose?.addEventListener("click", onCollectionClose);
    collectionClose?.addEventListener("pointerdown", stopBubble);
    collectionSheet?.addEventListener("pointerdown", stopBubble);

    coinsToggle?.addEventListener("click", onCoinsToggle);
    coinsToggle?.addEventListener("pointerdown", stopBubble);
    coinsClose?.addEventListener("click", onCoinsClose);
    coinsClose?.addEventListener("pointerdown", stopBubble);
    coinsSheet?.addEventListener("pointerdown", stopBubble);

    debugFab?.addEventListener("click", onDebugToggle);
    debugFab?.addEventListener("pointerdown", stopBubble);
    debugClose?.addEventListener("click", onDebugClose);
    debugClose?.addEventListener("pointerdown", stopBubble);
    debugPanel?.addEventListener("pointerdown", stopBubble);

    return () => {
      shopToggle?.removeEventListener("click", onShopToggle);
      shopToggle?.removeEventListener("pointerdown", stopBubble);
      shopClose?.removeEventListener("click", onShopClose);
      shopClose?.removeEventListener("pointerdown", stopBubble);
      shopSheet?.removeEventListener("pointerdown", stopBubble);

      collectionToggle?.removeEventListener("click", onCollectionToggle);
      collectionToggle?.removeEventListener("pointerdown", stopBubble);
      collectionClose?.removeEventListener("click", onCollectionClose);
      collectionClose?.removeEventListener("pointerdown", stopBubble);
      collectionSheet?.removeEventListener("pointerdown", stopBubble);

      coinsToggle?.removeEventListener("click", onCoinsToggle);
      coinsToggle?.removeEventListener("pointerdown", stopBubble);
      coinsClose?.removeEventListener("click", onCoinsClose);
      coinsClose?.removeEventListener("pointerdown", stopBubble);
      coinsSheet?.removeEventListener("pointerdown", stopBubble);

      debugFab?.removeEventListener("click", onDebugToggle);
      debugFab?.removeEventListener("pointerdown", stopBubble);
      debugClose?.removeEventListener("click", onDebugClose);
      debugClose?.removeEventListener("pointerdown", stopBubble);
      debugPanel?.removeEventListener("pointerdown", stopBubble);
    };
  };

  return {
    setShopOpen,
    setCollectionOpen,
    setCoinsOpen,
    setDebugSheetOpen,
    closeAll,
    bind,
  };
}
