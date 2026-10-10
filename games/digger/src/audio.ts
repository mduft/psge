/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Game SFX + mute preference (localStorage; independent of save blob).
 */
import coinUrl from "../assets/audio/coin.wav";

export const MUTE_STORAGE_KEY = "psge:digger:muted";

let muted = false;
let coinAudio: HTMLAudioElement | null = null;

function readStoredMute(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredMute(next: boolean): void {
  try {
    if (next) localStorage.setItem(MUTE_STORAGE_KEY, "1");
    else localStorage.removeItem(MUTE_STORAGE_KEY);
  } catch {
    /* private mode / quota */
  }
}

function ensureCoinAudio(): HTMLAudioElement {
  if (!coinAudio) {
    coinAudio = new Audio(coinUrl);
    coinAudio.preload = "auto";
  }
  return coinAudio;
}

/** Load mute flag from storage (call once at boot). */
export function initAudio(): boolean {
  muted = readStoredMute();
  return muted;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  writeStoredMute(next);
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

/** Short coin ping when a dirt/special coin mesh appears in the shaft. */
export function playCoinAppear(): void {
  if (muted) return;
  const a = ensureCoinAudio();
  try {
    a.currentTime = 0;
    void a.play().catch(() => {
      /* autoplay policy until a user gesture — mute FAB / dig covers that */
    });
  } catch {
    /* ignore */
  }
}
