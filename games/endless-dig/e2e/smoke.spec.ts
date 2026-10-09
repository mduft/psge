/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { expect, test } from "@playwright/test";

test("full-bleed dig-to-reveal boots", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(String(err));
  });

  await page.goto("/?depth=1000");
  await expect(page.getByRole("heading", { name: "The Endless Dig" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-psge-milestone", "2");
  await expect(page.locator("html")).toHaveAttribute("data-psge-world-extent", "1000");

  const canvas = page.locator("#game-canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(box!.width).toBeGreaterThan(viewport!.width * 0.9);

  // Debug scroll deep: chunk count must stay bounded.
  const stats = await page.evaluate(() => {
    const w = (
      window as unknown as {
        __psgeWorld: {
          setFocusBlockY: (y: number) => void;
          getLoadedChunkCount: () => number;
          getOriginBlockY: () => number;
          getFocusBlockY: () => number;
        };
      }
    ).__psgeWorld;

    const samples: number[] = [];
    for (const y of [0, -100, -400, -800, -980]) {
      w.setFocusBlockY(y);
      samples.push(w.getLoadedChunkCount());
    }
    return {
      samples,
      origin: w.getOriginBlockY(),
      focus: w.getFocusBlockY(),
    };
  });

  expect(Math.max(...stats.samples)).toBeLessThanOrEqual(12);
  expect(stats.origin).not.toBe(0);
  expect(stats.focus).toBeLessThan(-900);

  await expect.poll(() => consoleErrors, { timeout: 5000 }).toEqual([]);
});

test("tap dig increases depth/dirt and follows focus", async ({ page }) => {
  // No ?depth= — normal play starts at surface (param pre-excavates for testing).
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");

  const before = await page.evaluate(() => {
    const s = (
      window as unknown as { __psgeState: { depth: number; dirt: number } }
    ).__psgeState;
    const w = (
      window as unknown as { __psgeWorld: { getFocusBlockY: () => number } }
    ).__psgeWorld;
    return { depth: s.depth, dirt: s.dirt, focus: w.getFocusBlockY() };
  });

  expect(before.depth).toBe(0);
  expect(before.dirt).toBe(0);

  const canvas = page.locator("#game-canvas");
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  // Short click (no drag) so hold-drag treats it as a tap.
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-depth"))
    .not.toBe("0");

  const after = await page.evaluate(() => {
    const s = (
      window as unknown as { __psgeState: { depth: number; dirt: number } }
    ).__psgeState;
    const w = (
      window as unknown as {
        __psgeWorld: {
          getFocusBlockY: () => number;
          getExcavatedDepth: () => number;
        };
      }
    ).__psgeWorld;
    return {
      depth: s.depth,
      dirt: s.dirt,
      focus: w.getFocusBlockY(),
      excavated: w.getExcavatedDepth(),
    };
  });

  expect(after.depth).toBeGreaterThan(before.depth);
  expect(after.dirt).toBeGreaterThan(before.dirt);
  expect(after.excavated).toBeCloseTo(after.depth);
  expect(after.focus).toBeLessThan(before.focus);

  await expect(page.locator('[data-stat="depth"]')).not.toHaveText("0 m");
  await expect(page.locator('[data-stat="dirt"]')).not.toHaveText("0");
});

test("stress depth=10000 keeps chunk window bounded", async ({ page }) => {
  await page.goto("/?depth=10000");
  await expect(page.locator("html")).toHaveAttribute("data-psge-world-extent", "10000");

  const maxChunks = await page.evaluate(() => {
    const w = (
      window as unknown as {
        __psgeWorld: {
          setFocusBlockY: (y: number) => void;
          getLoadedChunkCount: () => number;
        };
      }
    ).__psgeWorld;

    let max = 0;
    for (let y = 0; y >= -9900; y -= 250) {
      w.setFocusBlockY(y);
      max = Math.max(max, w.getLoadedChunkCount());
    }
    return max;
  });

  expect(maxChunks).toBeLessThanOrEqual(12);
});
