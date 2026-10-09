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

  await page.goto("/?nosave=1&depth=1000");
  await expect(page.getByRole("heading", { name: "The Endless Dig" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-psge-milestone", "3");
  await expect(page.locator("html")).toHaveAttribute("data-psge-world-extent", "1000");

  const canvas = page.locator("#game-canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(box!.width).toBeGreaterThan(viewport!.width * 0.9);

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
  await page.goto("/?nosave=1");
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
});

test("reload restores saved progress", async ({ page }) => {
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");

  await page.evaluate(async () => {
    const s = (
      window as unknown as {
        __psgeState: {
          depth: number;
          dirt: number;
          digPower: number;
          version: number;
        };
        __psgeSaveStore: { save: (data: unknown) => Promise<void> };
        __psgeWorld: { setExcavatedDepth: (d: number) => void };
      }
    );
    s.__psgeState.depth = 12.5;
    s.__psgeState.dirt = 50;
    s.__psgeState.digPower = 1;
    s.__psgeWorld.setExcavatedDepth(12.5);
    await s.__psgeSaveStore.save({
      version: 2,
      depth: 12.5,
      dirt: 50,
      digPower: 1,
    });
  });

  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-depth"))
    .toBe("12.5");

  const restored = await page.evaluate(() => {
    const s = (
      window as unknown as { __psgeState: { depth: number; dirt: number } }
    ).__psgeState;
    return { depth: s.depth, dirt: s.dirt };
  });
  expect(restored.depth).toBe(12.5);
  expect(restored.dirt).toBe(50);
});

test("nosave=1 clears persistence", async ({ page }) => {
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");

  await page.evaluate(async () => {
    const s = (
      window as unknown as {
        __psgeSaveStore: { save: (data: unknown) => Promise<void> };
      }
    );
    await s.__psgeSaveStore.save({
      version: 2,
      depth: 99,
      dirt: 400,
      digPower: 1,
    });
  });

  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-psge-nosave", "1");

  const state = await page.evaluate(() => {
    const s = (
      window as unknown as { __psgeState: { depth: number; dirt: number } }
    ).__psgeState;
    return { depth: s.depth, dirt: s.dirt };
  });
  expect(state.depth).toBe(0);
  expect(state.dirt).toBe(0);
});

test("stress depth=10000 keeps chunk window bounded", async ({ page }) => {
  await page.goto("/?nosave=1&depth=10000");
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
