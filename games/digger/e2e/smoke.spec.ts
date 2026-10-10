/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { expect, test, type Page } from "@playwright/test";

type DecLike = { toNumber: () => number; toString: () => string };

const DIG_SAVE_KEY = "psge:digger:save";

/** Seed localStorage before game boot (survives prior-page pagehide flush). */
async function seedSaveBeforeGoto(
  page: Page,
  blob: Record<string, unknown>,
): Promise<void> {
  await page.addInitScript(
    ({ key, data }) => {
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: DIG_SAVE_KEY, data: blob },
  );
}

/** Open the tabbed HUD panel on a given tab (wide may already be open). */
async function ensurePanelTab(
  page: Page,
  tab: "shop" | "collection" | "coins" | "achievements",
): Promise<void> {
  const panelOpen = await page.locator("html").getAttribute("data-psge-panel");
  if (panelOpen !== "open") {
    await page.locator("#panel-toggle").click();
  }
  const current = await page
    .locator("html")
    .getAttribute("data-psge-panel-tab");
  if (current !== tab) {
    await page.locator(`[data-panel-tab="${tab}"]`).click();
  }
  await expect(page.locator("html")).toHaveAttribute("data-psge-panel", "open");
  await expect(page.locator(`[data-panel-pane="${tab}"]`)).toBeVisible();
}

async function ensureShopOpen(page: Page): Promise<void> {
  await ensurePanelTab(page, "shop");
  await expect(page.locator("html")).toHaveAttribute("data-psge-shop", "open");
}

async function ensureCollectionOpen(page: Page): Promise<void> {
  await ensurePanelTab(page, "collection");
  await expect(page.locator("html")).toHaveAttribute(
    "data-psge-collection",
    "open",
  );
}

async function ensureCoinsOpen(page: Page): Promise<void> {
  await ensurePanelTab(page, "coins");
  await expect(page.locator("html")).toHaveAttribute(
    "data-psge-coin-sheet",
    "open",
  );
}

async function ensureAchievementsOpen(page: Page): Promise<void> {
  await ensurePanelTab(page, "achievements");
  await expect(page.locator("html")).toHaveAttribute(
    "data-psge-achievements",
    "open",
  );
}

async function ensureDebugOpen(page: Page): Promise<void> {
  const fab = page.locator("#debug-fab");
  await expect(fab).toBeVisible();
  const open = await page
    .locator("html")
    .getAttribute("data-psge-debug-sheet");
  if (open !== "open") await fab.click();
  await expect(page.locator("#debug-panel")).toBeVisible();
}

test("panel tabs switch and only one pane is active", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("#panel-toggle")).toBeVisible();
  await page.locator("#panel-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-psge-panel", "open");
  await expect(page.locator("[data-panel-tab]")).toHaveCount(4);

  await page.locator('[data-panel-tab="achievements"]').click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-psge-achievements",
    "open",
  );
  await expect(page.locator("html")).toHaveAttribute("data-psge-shop", "closed");
  await expect(page.locator("#panel-achievements")).toBeVisible();
  await expect(page.locator("#panel-shop")).toBeHidden();

  await page.locator('[data-panel-tab="shop"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-psge-shop", "open");
  await expect(page.locator("#panel-shop")).toBeVisible();
});

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
  await expect(page.getByRole("heading", { name: "Digger" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-psge-milestone", "9");
  await expect
    .poll(async () =>
      Number(await page.locator("html").getAttribute("data-psge-world-extent")),
    )
    .toBeGreaterThanOrEqual(1000);

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
      window as unknown as {
        __psgeState: { depth: DecLike; dirt: DecLike };
      }
    ).__psgeState;
    const w = (
      window as unknown as { __psgeWorld: { getFocusBlockY: () => number } }
    ).__psgeWorld;
    return {
      depth: s.depth.toNumber(),
      dirt: s.dirt.toNumber(),
      focus: w.getFocusBlockY(),
    };
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
      window as unknown as {
        __psgeState: { depth: DecLike; dirt: DecLike };
      }
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
      depth: s.depth.toNumber(),
      dirt: s.dirt.toNumber(),
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
  await seedSaveBeforeGoto(page, {
    version: 3,
    depth: "12.5",
    dirt: "50",
    upgrades: {
      shovel: 0,
      pickaxe: 0,
      jackhammer: 0,
      cart: 0,
      drill: 0,
      crew: 0,
    },
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-depth"))
    .toBe("12.5");

  const restored = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __psgeState: { depth: DecLike; dirt: DecLike };
      }
    ).__psgeState;
    return { depth: s.depth.toNumber(), dirt: s.dirt.toNumber() };
  });
  expect(restored.depth).toBe(12.5);
  expect(restored.dirt).toBe(50);
});

test("deep save expands world extent on reload", async ({ page }) => {
  await seedSaveBeforeGoto(page, {
    version: 3,
    depth: "1500",
    dirt: "6000",
    upgrades: {
      shovel: 0,
      pickaxe: 0,
      jackhammer: 0,
      cart: 0,
      drill: 0,
      crew: 0,
    },
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect
    .poll(async () =>
      Number(await page.locator("html").getAttribute("data-psge-world-extent")),
    )
    .toBeGreaterThanOrEqual(1500);
  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-depth"))
    .toBe("1500");

  const restored = await page.evaluate(() => {
    const w = window as unknown as {
      __psgeWorld: {
        getExcavatedDepth: () => number;
        getWorldExtent: () => number;
      };
      __psgeState: { depth: DecLike };
    };
    return {
      depth: w.__psgeState.depth.toNumber(),
      excavated: w.__psgeWorld.getExcavatedDepth(),
      extent: w.__psgeWorld.getWorldExtent(),
    };
  });
  expect(restored.depth).toBe(1500);
  expect(restored.excavated).toBe(1500);
  expect(restored.extent).toBeGreaterThanOrEqual(1500);
});

test("autosave persists after dig debounce", async ({ page }) => {
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");

  const canvas = page.locator("#game-canvas");
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-depth"))
    .not.toBe("0");

  // Boot may autosave depth 0 (lastPlayedAtMs); wait until the dig landed in storage.
  await expect
    .poll(
      async () => {
        const match = await page.evaluate(async () => {
          const store = window as unknown as {
            __psgeSaveStore: { load: () => Promise<unknown> };
            __psgeState: { depth: DecLike; dirt: DecLike };
          };
          const blob = (await store.__psgeSaveStore.load()) as {
            depth: string;
            dirt: string;
          } | null;
          if (!blob) return null;
          const depth = store.__psgeState.depth.toString();
          const dirt = store.__psgeState.dirt.toString();
          return blob.depth === depth && blob.dirt === dirt ? "ok" : "pending";
        });
        return match;
      },
      { timeout: 5000 },
    )
    .toBe("ok");
});

test("reset button clears depth and save", async ({ page }) => {
  await page.goto("/?nosave=1&depth=50&debug=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await ensureDebugOpen(page);
  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-depth"))
    .toBe("50");

  await page.getByRole("button", { name: "Reset" }).click();

  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-depth"))
    .toBe("0");
  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-dirt"))
    .toBe("0");
  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-saved"))
    .toBe("1");

  const saved = await page.evaluate(async () => {
    const store = window as unknown as {
      __psgeSaveStore: { load: () => Promise<unknown> };
      __psgeState: {
        depth: DecLike;
        dirt: DecLike;
        upgrades: { shovel: number };
      };
      __psgeWorld: { getExcavatedDepth: () => number };
    };
    return {
      blob: await store.__psgeSaveStore.load(),
      depth: store.__psgeState.depth.toNumber(),
      dirt: store.__psgeState.dirt.toNumber(),
      shovel: store.__psgeState.upgrades.shovel,
      excavated: store.__psgeWorld.getExcavatedDepth(),
    };
  });
  expect(saved.depth).toBe(0);
  expect(saved.dirt).toBe(0);
  expect(saved.shovel).toBe(0);
  expect(saved.excavated).toBe(0);
  expect(saved.blob).toMatchObject({ depth: "0", dirt: "0" });
});

test("shop buy spends dirt and raises dig power", async ({ page }) => {
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");

  await page.evaluate(() => {
    const s = (
      window as unknown as {
        __psgeState: { dirt: DecLike; upgrades: { shovel: number } };
      }
    ).__psgeState;
    const D = Object.getPrototypeOf(s.dirt).constructor as new (
      n: number,
    ) => DecLike;
    (s as { dirt: DecLike }).dirt = new D(100);
    window.dispatchEvent(new Event("resize"));
  });

  await ensureShopOpen(page);
  await expect(page.locator('#panel-shop [data-shop-buy="shovel"]')).toBeEnabled();

  const before = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __psgeState: { dirt: DecLike; upgrades: { shovel: number } };
      }
    ).__psgeState;
    return { dirt: s.dirt.toNumber(), shovel: s.upgrades.shovel };
  });
  expect(before.dirt).toBe(100);
  expect(before.shovel).toBe(0);

  const digPowerBefore = await page.locator('[data-stat="dig-power"]').innerText();
  await page.locator('#panel-shop [data-shop-buy="shovel"]').click();

  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __psgeState: { upgrades: { shovel: number } };
            }
          ).__psgeState.upgrades.shovel,
      ),
    )
    .toBe(1);

  const after = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __psgeState: { dirt: DecLike; upgrades: { shovel: number } };
      }
    ).__psgeState;
    return { dirt: s.dirt.toNumber(), shovel: s.upgrades.shovel };
  });
  expect(after.shovel).toBe(1);
  expect(after.dirt).toBe(80);
  const digPowerAfter = await page.locator('[data-stat="dig-power"]').innerText();
  expect(digPowerAfter).not.toBe(digPowerBefore);
});

test("first dig unlocks an achievement toast and sheet row", async ({
  page,
}) => {
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-psge-milestone", "9");

  const canvas = page.locator("#game-canvas");
  await canvas.click({ position: { x: 200, y: 300 } });

  await expect
    .poll(async () =>
      page.locator("html").getAttribute("data-psge-achievements-count"),
    )
    .not.toBe("0");

  await expect(page.locator("#achievement-toast")).toHaveClass(/is-visible/);
  await expect(page.locator("[data-achievement-toast-name]")).toHaveText(
    "First dig",
  );

  await ensureAchievementsOpen(page);
  const row = page.locator(
    '#achievements-list [data-achievement="first-dig"]',
  );
  await expect(row).toHaveAttribute("data-unlocked", "1");
  await expect(row.locator(".collection-name")).toHaveText("First dig");
});

test("achievement unlock persists across reload", async ({ page }) => {
  await seedSaveBeforeGoto(page, {
    version: 8,
    depth: "1",
    dirt: "4",
    upgrades: {
      shovel: 0,
      pickaxe: 0,
      jackhammer: 0,
      cart: 0,
      drill: 0,
      crew: 0,
    },
    lastPlayedAtMs: Date.now(),
    discoveries: { unlocked: [], worldSeed: 1, digRollMeter: 0 },
    boosters: { claimed: [], dirtEarned: 0 },
    specialCoins: { unlocked: [] },
    achievements: {
      unlocked: ["first-dig"],
      afkDigSeen: false,
      overnightClaimed: false,
    },
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect
    .poll(async () =>
      page.locator("html").getAttribute("data-psge-achievements-count"),
    )
    .toBe("1");
  await ensureAchievementsOpen(page);
  await expect(
    page.locator('#achievements-list [data-achievement="first-dig"]'),
  ).toHaveAttribute("data-unlocked", "1");
});

test("agent-loop verify: shop buy + state inspect + screenshot", async ({
  page,
}) => {
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-psge-milestone", "9");

  await page.evaluate(() => {
    const s = (
      window as unknown as {
        __psgeState: { dirt: DecLike };
      }
    ).__psgeState;
    const D = Object.getPrototypeOf(s.dirt).constructor as new (
      n: number,
    ) => DecLike;
    (s as { dirt: DecLike }).dirt = new D(100);
    window.dispatchEvent(new Event("resize"));
  });

  await ensureShopOpen(page);
  const buy = page.locator('#panel-shop [data-shop-buy="shovel"]');
  await expect(buy).toBeEnabled();
  const powerBefore = await page
    .locator("html")
    .getAttribute("data-psge-dig-power");
  await buy.click();

  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __psgeState: { upgrades: { shovel: number } };
            }
          ).__psgeState.upgrades.shovel,
      ),
    )
    .toBe(1);

  const powerAfter = await page
    .locator("html")
    .getAttribute("data-psge-dig-power");
  expect(Number(powerAfter)).toBeGreaterThan(Number(powerBefore));

  await page.screenshot({
    path: "test-results/m8-agent-loop-shop.png",
    fullPage: true,
  });
});

test("narrow shop opens as a sheet before buy", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-psge-shop", "closed");

  await page.evaluate(() => {
    const s = (
      window as unknown as {
        __psgeState: { dirt: DecLike };
      }
    ).__psgeState;
    const D = Object.getPrototypeOf(s.dirt).constructor as new (
      n: number,
    ) => DecLike;
    (s as { dirt: DecLike }).dirt = new D(100);
    window.dispatchEvent(new Event("resize"));
  });

  await expect(page.locator("#panel-toggle")).toBeVisible();
  await expect(page.locator("[data-shop-afford]")).toBeVisible();
  await page.locator("#panel-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-psge-shop", "open");
  const buyShovel = page.locator('#panel-shop [data-shop-buy="shovel"]');
  await expect(buyShovel).toBeEnabled();
  await buyShovel.evaluate((el) => (el as HTMLButtonElement).click());
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __psgeState: { upgrades: { shovel: number } };
            }
          ).__psgeState.upgrades.shovel,
      ),
    )
    .toBe(1);
});

test("passive cart digs without tapping", async ({ page }) => {
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");

  await page.evaluate(() => {
    const s = (
      window as unknown as {
        __psgeState: {
          upgrades: { cart: number };
          depth: DecLike;
        };
      }
    ).__psgeState;
    s.upgrades.cart = 1;
    window.dispatchEvent(new Event("resize"));
  });

  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-depth"), {
      timeout: 5000,
    })
    .not.toBe("0");
});

test("geo layer updates at 1000m", async ({ page }) => {
  await page.goto("/?nosave=1&depth=1000");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-psge-layer", "clay");
  await expect(page.locator("[data-layer-plate]")).toHaveAttribute(
    "data-layer",
    "clay",
  );
  await expect(page.locator("[data-layer-plate-name]")).toHaveText(
    "Packed clay",
  );
});

test("depth milestones unlock discoveries into the collection", async ({
  page,
}) => {
  await page.goto("/?nosave=1&depth=30");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("html")).toHaveAttribute(
    "data-psge-milestone",
    "9",
  );
  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-discoveries"))
    .not.toBe("0");
  await expect(page.locator("#find-backdrop")).toBeVisible();
  await expect(page.locator("[data-find-name]")).toHaveText("Ancient bone");
  await expect(page.locator("[data-find-blurb]")).not.toHaveText("—");
  // Auto-close is 5s; under load the countdown may already have finished.
  const findContinue = page.locator("#find-continue");
  if (await findContinue.isVisible()) {
    await findContinue.click();
  }
  await expect
    .poll(async () => page.locator("#find-backdrop").isHidden())
    .toBe(true);
  // Drain any queued find reveals so the panel is free to open.
  for (let i = 0; i < 8; i++) {
    if (await page.locator("#find-backdrop").isHidden()) break;
    const btn = page.locator("#find-continue");
    if (await btn.isVisible()) await btn.click();
    else break;
  }
  await ensureCollectionOpen(page);
  await expect(
    page.locator('#collection-list [data-discovery="bone_shard"]'),
  ).toHaveAttribute("data-unlocked", "1");
  await expect(
    page.locator('#collection-list [data-discovery="bone_shard"] .collection-name'),
  ).toHaveText("Ancient bone");
});

test("special coins unlock into coin collection via find reveal", async ({
  page,
}) => {
  await page.goto("/?nosave=1&debug=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await ensureDebugOpen(page);
  await page.locator("#debug-unlock-coin").click();
  await expect(page.locator("#find-backdrop")).toBeVisible();
  await expect(page.locator("[data-find-eyebrow]")).toHaveText("Special coin");
  await expect(page.locator("[data-find-name]")).toHaveText("Copper bit");
  const findContinue = page.locator("#find-continue");
  if (await findContinue.isVisible()) {
    await findContinue.click();
  }
  await expect
    .poll(async () => page.locator("#find-backdrop").isHidden())
    .toBe(true);
  // Close debug so the panel dock is free.
  await page.locator("#debug-close").click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-psge-debug-sheet",
    "closed",
  );
  await ensureCoinsOpen(page);
  await expect(
    page.locator('#coins-list [data-special-coin="copper_bit"]'),
  ).toHaveAttribute("data-unlocked", "1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-psge-special-coins",
    "1",
  );
});

test("shop panel stays open while digging on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  // Wide opens the dock under the stats rail by default.
  await expect(page.locator("html")).toHaveAttribute("data-psge-panel", "open");
  await expect(page.locator("html")).toHaveAttribute("data-psge-shop", "open");
  await expect(page.locator("#panel-shop")).toBeVisible();

  const before = await page.locator("html").getAttribute("data-psge-depth");
  const canvas = page.locator("#game-canvas");
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  // Tap left of the right-rail dock so dig hits the canvas, not the panel.
  await page.mouse.click(box!.x + box!.width * 0.35, box!.y + box!.height * 0.5);
  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-depth"))
    .not.toBe(before);
  await expect(page.locator("html")).toHaveAttribute("data-psge-shop", "open");
  await expect(page.locator("#panel-shop")).toBeVisible();
});

test("offline claim grants depth and dirt", async ({ page }) => {
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");

  // Keep in-memory state in sync so page teardown flush cannot clobber the seed.
  await page.evaluate(async () => {
    const w = window as unknown as {
      __psgeSaveStore: { save: (data: unknown) => Promise<void> };
      __psgeState: {
        depth: DecLike;
        dirt: DecLike;
        upgrades: Record<string, number>;
        lastPlayedAtMs: number;
      };
    };
    const leftAt = Date.now() - 3_600_000;
    w.__psgeState.upgrades = {
      shovel: 0,
      pickaxe: 0,
      jackhammer: 0,
      cart: 1,
      drill: 0,
      crew: 0,
    };
    w.__psgeState.lastPlayedAtMs = leftAt;
    await w.__psgeSaveStore.save({
      version: 4,
      depth: w.__psgeState.depth.toString(),
      dirt: w.__psgeState.dirt.toString(),
      lastPlayedAtMs: leftAt,
      upgrades: { ...w.__psgeState.upgrades },
    });
  });

  await page.goto("/?offlineMs=3600000");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("html")).toHaveAttribute(
    "data-psge-offline",
    "pending",
  );
  await expect(page.locator("#offline-backdrop")).toBeVisible();
  await expect(page.locator("#offline-claim")).toBeVisible();

  await page.locator("#offline-claim").click();

  await expect(page.locator("html")).toHaveAttribute(
    "data-psge-offline",
    "claimed",
  );
  await expect(page.locator("#offline-backdrop")).toBeHidden();
  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-depth"))
    .not.toBe("0");
  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-dirt"))
    .not.toBe("0");
});

test("debug=1 shows tools; default hides them", async ({ page }) => {
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("#debug-panel")).toBeHidden();
  await expect(page.locator("#debug-fab")).toBeHidden();
  await expect(page.locator("html")).not.toHaveAttribute("data-psge-debug", "1");

  await page.goto("/?nosave=1&debug=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-psge-debug", "1");
  await ensureDebugOpen(page);
  await expect(page.locator("#debug-scroll")).toBeVisible();
  await expect(page.locator("#debug-scroll")).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();

  await page.locator('[data-give-dirt="100"]').click();
  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-dirt"))
    .toBe("100");

  await expect(page.locator('[data-jump-layer="clay"]')).toBeVisible();
  await page.locator('[data-jump-layer="clay"]').click();
  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-depth"))
    .toBe("995");
});

test("narrow debug opens as a sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?nosave=1&debug=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("#debug-fab")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-psge-debug-sheet",
    "closed",
  );

  await page.locator("#debug-fab").click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-psge-debug-sheet",
    "open",
  );
  await expect(page.locator("#debug-scroll")).toBeVisible();
  await page.locator('[data-give-dirt="100"]').evaluate((el) =>
    (el as HTMLButtonElement).click(),
  );
  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-dirt"))
    .toBe("100");
});

test("digging past 1000 expands world extent", async ({ page }) => {
  await page.goto("/?nosave=1&debug=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");

  await page.evaluate(() => {
    const s = (
      window as unknown as {
        __psgeState: { depth: DecLike; dirt: DecLike };
        __psgeWorld: {
          setExcavatedDepth: (d: number) => void;
          ensureWorldExtent: (n: number) => boolean;
          getWorldExtent: () => number;
        };
      }
    );
    const D = Object.getPrototypeOf(s.__psgeState.depth).constructor as new (
      n: number,
    ) => DecLike;
    (s.__psgeState as { depth: DecLike }).depth = new D(1500);
    (s.__psgeState as { dirt: DecLike }).dirt = new D(6000);
    s.__psgeWorld.ensureWorldExtent(1500 + 64);
    s.__psgeWorld.setExcavatedDepth(1500);
    window.dispatchEvent(new Event("resize"));
  });

  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-depth"))
    .toBe("1500");

  const extent = await page.evaluate(() =>
    (
      window as unknown as { __psgeWorld: { getWorldExtent: () => number } }
    ).__psgeWorld.getWorldExtent(),
  );
  expect(extent).toBeGreaterThanOrEqual(1500);
});

test("save/reload keeps upgrade levels", async ({ page }) => {
  await seedSaveBeforeGoto(page, {
    version: 3,
    depth: "3",
    dirt: "20",
    upgrades: {
      shovel: 2,
      pickaxe: 0,
      jackhammer: 0,
      cart: 1,
      drill: 0,
      crew: 0,
    },
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");

  const levels = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __psgeState: { upgrades: { shovel: number; cart: number } };
      }
    ).__psgeState;
    return { shovel: s.upgrades.shovel, cart: s.upgrades.cart };
  });
  expect(levels.shovel).toBe(2);
  expect(levels.cart).toBe(1);
});

test("nosave=1 clears persistence", async ({ page }) => {
  await seedSaveBeforeGoto(page, {
    version: 3,
    depth: "99",
    dirt: "400",
    upgrades: {
      shovel: 1,
      pickaxe: 0,
      jackhammer: 0,
      cart: 0,
      drill: 0,
      crew: 0,
    },
  });
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-psge-nosave", "1");

  const state = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __psgeState: { depth: DecLike; dirt: DecLike };
      }
    ).__psgeState;
    return { depth: s.depth.toNumber(), dirt: s.dirt.toNumber() };
  });
  expect(state.depth).toBe(0);
  expect(state.dirt).toBe(0);
});

test("stress depth=10000 keeps chunk window bounded", async ({ page }) => {
  await page.goto("/?nosave=1&depth=10000");
  await expect
    .poll(async () =>
      Number(await page.locator("html").getAttribute("data-psge-world-extent")),
    )
    .toBeGreaterThanOrEqual(10000);

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
