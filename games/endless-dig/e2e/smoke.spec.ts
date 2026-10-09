/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import { expect, test } from "@playwright/test";

type DecLike = { toNumber: () => number; toString: () => string };

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
  await expect(page.locator("html")).toHaveAttribute("data-psge-milestone", "4");
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
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");

  await page.evaluate(async () => {
    const s = window as unknown as {
      __psgeSaveStore: { save: (data: unknown) => Promise<void> };
    };
    await s.__psgeSaveStore.save({
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
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");

  await page.evaluate(async () => {
    const s = window as unknown as {
      __psgeSaveStore: { save: (data: unknown) => Promise<void> };
    };
    await s.__psgeSaveStore.save({
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

  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-saved"), {
      timeout: 5000,
    })
    .toBe("1");

  const saved = await page.evaluate(async () => {
    const store = window as unknown as {
      __psgeSaveStore: { load: () => Promise<unknown> };
      __psgeState: { depth: DecLike; dirt: DecLike };
    };
    const blob = (await store.__psgeSaveStore.load()) as {
      depth: string;
      dirt: string;
    } | null;
    return {
      blob,
      depth: store.__psgeState.depth.toString(),
      dirt: store.__psgeState.dirt.toString(),
    };
  });

  expect(saved.blob).toBeTruthy();
  expect(saved.blob!.depth).toBe(saved.depth);
  expect(saved.blob!.dirt).toBe(saved.dirt);
});

test("reset button clears depth and save", async ({ page }) => {
  await page.goto("/?nosave=1&depth=50&debug=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("#debug-panel")).toBeVisible();
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

  await expect(page.locator('[data-shop-buy="shovel"]')).toBeEnabled();

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
  await page.locator('[data-shop-buy="shovel"]').click();

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

  await expect(page.locator("#shop-toggle")).toBeVisible();
  await expect(page.locator('[data-shop-afford]')).toBeVisible();
  await page.locator("#shop-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-psge-shop", "open");
  const buyShovel = page.locator('#shop-sheet [data-shop-buy="shovel"]');
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

test("debug=1 shows tools; default hides them", async ({ page }) => {
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("#debug-panel")).toBeHidden();
  await expect(page.locator("#debug-fab")).toBeHidden();
  await expect(page.locator("html")).not.toHaveAttribute("data-psge-debug", "1");

  await page.goto("/?nosave=1&debug=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-psge-debug", "1");
  await expect(page.locator("#debug-panel")).toBeVisible();
  await expect(page.locator("#debug-scroll")).toBeVisible();
  await expect(page.locator("#debug-scroll")).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();

  await page.locator('[data-give-dirt="100"]').click();
  await expect
    .poll(async () => page.locator("html").getAttribute("data-psge-dirt"))
    .toBe("100");
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
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");

  await page.evaluate(async () => {
    const s = window as unknown as {
      __psgeSaveStore: { save: (data: unknown) => Promise<void> };
    };
    await s.__psgeSaveStore.save({
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
  await page.goto("/?nosave=1");
  await expect(page.locator("html")).toHaveAttribute("data-psge-ready", "true");

  await page.evaluate(async () => {
    const s = window as unknown as {
      __psgeSaveStore: { save: (data: unknown) => Promise<void> };
    };
    await s.__psgeSaveStore.save({
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
