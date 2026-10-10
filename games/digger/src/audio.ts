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

let railAudioCtx: AudioContext | null = null;

function ensureRailAudioCtx(): AudioContext | null {
  const AC =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (
          globalThis as unknown as {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;
  if (!AC) return null;
  if (!railAudioCtx) railAudioCtx = new AC();
  return railAudioCtx;
}

/** Short metallic clink when a minecart / shaft scrolls into view. */
export function playRailClink(): void {
  if (muted) return;
  const ctx = ensureRailAudioCtx();
  if (!ctx) return;
  try {
    void ctx.resume().catch(() => {});
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.08);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.14);
  } catch {
    /* ignore */
  }
}
