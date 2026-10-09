import { expect, test } from "@playwright/test";

test("full-bleed block cutaway boots", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(String(err));
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The Endless Dig" })).toBeVisible();
  await expect(page.locator("#dig")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-psge-milestone", "1");
  await expect(page.locator('[data-stat="depth"]')).toBeVisible();

  const canvas = page.locator("#game-canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  // Full-bleed: canvas should fill most of the viewport (not an inset card).
  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  expect(box!.width).toBeGreaterThan(viewport!.width * 0.9);
  expect(box!.height).toBeGreaterThan(viewport!.height * 0.9);

  await expect.poll(() => consoleErrors, { timeout: 5000 }).toEqual([]);

  await page.screenshot({
    path: "games/endless-dig/e2e/screenshots/m1-blocks.png",
    fullPage: true,
  });
});
