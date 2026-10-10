/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Queued discovery / special-coin find modal with auto-close countdown.
 */
import { DISCOVERY_DEFS } from "./discoveries.js";
import { formatAmount } from "./formatAmount.js";
import {
  getSpecialCoinDef,
  type SpecialCoinClaim,
} from "./specialCoins.js";

export type FindRevealItem =
  | { kind: "discovery"; id: string }
  | { kind: "special"; id: string; via: "tap" | "auto"; dirt: number };

export interface FindReveal {
  /** True while the modal is visible. */
  get isOpen(): boolean;
  enqueueDiscoveries(ids: string[]): void;
  enqueueSpecialClaims(claims: SpecialCoinClaim[]): void;
  /** Try to show the next queued find (no-op if open / blocked). */
  pump(): void;
  hide(): void;
  dispose(): void;
}

export function createFindReveal(options: {
  autoCloseMs: number;
  /** When true, defer pumping (e.g. offline claim pending). */
  isBlocked: () => boolean;
}): FindReveal {
  const findBackdrop = document.querySelector<HTMLElement>("#find-backdrop");
  const findEyebrow = document.querySelector("[data-find-eyebrow]");
  const findIcon = document.querySelector<HTMLElement>("[data-find-icon]");
  const findName = document.querySelector("[data-find-name]");
  const findBlurb = document.querySelector("[data-find-blurb]");
  const findQueueEl = document.querySelector<HTMLElement>("[data-find-queue]");
  const findContinue = document.querySelector<HTMLButtonElement>(
    "#find-continue",
  );

  const queue: FindRevealItem[] = [];
  let open = false;
  let autoCloseTimer = 0;

  const clearAutoClose = (): void => {
    if (autoCloseTimer !== 0) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = 0;
    }
    findContinue?.classList.remove("is-counting");
  };

  const hide = (): void => {
    clearAutoClose();
    findBackdrop?.setAttribute("hidden", "");
    open = false;
    document.documentElement.dataset.psgeFind = "none";
  };

  const show = (item: FindRevealItem): void => {
    if (item.kind === "special") {
      const def = getSpecialCoinDef(item.id);
      if (findEyebrow) {
        findEyebrow.textContent =
          item.via === "tap" && item.dirt > 0
            ? `Special coin · tap +${formatAmount(item.dirt)} dirt`
            : "Special coin";
      }
      if (findIcon) {
        findIcon.className = "find-icon coin-mark";
        findIcon.textContent = def?.mark ?? "?";
        findIcon.style.background = def
          ? `#${def.tint.toString(16).padStart(6, "0")}`
          : "#c4a050";
      }
      if (findName) findName.textContent = def?.name ?? item.id;
      if (findBlurb) {
        const base = def?.blurb ?? "A rare coin from the shaft.";
        findBlurb.textContent =
          item.via === "tap" && item.dirt > 0
            ? `${base} (+${formatAmount(item.dirt)} dirt for the grab.)`
            : base;
      }
    } else {
      const def = DISCOVERY_DEFS.find((d) => d.id === item.id);
      if (findEyebrow) findEyebrow.textContent = "Discovery";
      if (findIcon) {
        findIcon.className = `discovery-icon find-icon icon-${def?.icon ?? "stone"}`;
        findIcon.textContent = "";
        findIcon.style.background = "";
      }
      if (findName) findName.textContent = def?.name ?? item.id;
      if (findBlurb) {
        findBlurb.textContent =
          def?.blurb ?? "A curious find from the shaft.";
      }
    }
    if (findQueueEl) {
      const more = queue.length;
      if (more > 0) {
        findQueueEl.hidden = false;
        findQueueEl.textContent =
          more === 1
            ? "1 more find waiting"
            : `${more} more finds waiting`;
      } else {
        findQueueEl.hidden = true;
        findQueueEl.textContent = "";
      }
    }
    findBackdrop?.removeAttribute("hidden");
    open = true;
    document.documentElement.dataset.psgeFind = `${item.kind}:${item.id}`;
    clearAutoClose();
    if (findContinue) {
      void findContinue.offsetWidth;
      findContinue.classList.add("is-counting");
    }
    autoCloseTimer = window.setTimeout(() => {
      autoCloseTimer = 0;
      hide();
      pump();
    }, options.autoCloseMs);
    findContinue?.focus();
  };

  const pump = (): void => {
    if (open || queue.length === 0) return;
    if (options.isBlocked()) return;
    show(queue.shift()!);
  };

  const onContinue = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    hide();
    pump();
  };
  const stopBubble = (ev: Event): void => {
    ev.stopPropagation();
  };
  findContinue?.addEventListener("click", onContinue);
  findContinue?.addEventListener("pointerdown", stopBubble);
  findBackdrop?.addEventListener("pointerdown", stopBubble);

  return {
    get isOpen() {
      return open;
    },
    enqueueDiscoveries(ids): void {
      if (ids.length > 0) {
        queue.push(...ids.map((id) => ({ kind: "discovery" as const, id })));
      }
      pump();
    },
    enqueueSpecialClaims(claims): void {
      if (claims.length > 0) {
        queue.push(
          ...claims.map((c) => ({
            kind: "special" as const,
            id: c.id,
            via: c.via,
            dirt: c.dirt,
          })),
        );
      }
      pump();
    },
    pump,
    hide,
    dispose(): void {
      clearAutoClose();
      findContinue?.removeEventListener("click", onContinue);
      findContinue?.removeEventListener("pointerdown", stopBubble);
      findBackdrop?.removeEventListener("pointerdown", stopBubble);
      hide();
      queue.length = 0;
    },
  };
}
