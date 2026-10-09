import { expect, test } from "@playwright/test";

test("full-bleed chunked cutaway boots", async ({ page }) => {
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
  await expect(page.locator("html")).toHaveAttribute("data-psge-milestone", "1.1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-shaft-depth", "1000");

  const canvas = page.locator("#game-canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(box!.width).toBeGreaterThan(viewport!.width * 0.9);

  // Scroll deep: chunk count must stay bounded (not grow with depth).
  const stats = await page.evaluate(async () => {
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
  expect(stats.origin).not.toBe(0); // floating origin should have rebased
  expect(stats.focus).toBeLessThan(-900);

  await expect.poll(() => consoleErrors, { timeout: 5000 }).toEqual([]);
});

test("stress depth=10000 keeps chunk window bounded", async ({ page }) => {
  await page.goto("/?depth=10000");
  await expect(page.locator("html")).toHaveAttribute("data-psge-shaft-depth", "10000");

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
