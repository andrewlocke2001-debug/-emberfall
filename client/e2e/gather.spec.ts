import { test, expect } from "@playwright/test";
import { enterWorldAsGm, clearBag } from "./helpers";
import type { Page } from "@playwright/test";

const ore = (page: Page): Promise<number> =>
  page.evaluate(() =>
    window.__mmo!.inventory().reduce((n, s) => (s.itemId === "copper_ore" ? n + s.qty : n), 0),
  );
const miningXp = (page: Page): Promise<number> => page.evaluate(() => window.__mmo!.me()!.miningXp);

// Meadowbrook's copper rock (node "copper-1") sits at (304, 1072); GM /tp lands
// us on it, then mining auto-repeats while we stand still.
test("mining a rock yields ore and Mining XP", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  await clearBag(page);
  await page.waitForTimeout(700);

  await page.fill("#chat-input", "/tp 304 1072");
  await page.press("#chat-input", "Enter");
  await expect.poll(() => page.evaluate(() => window.__mmo!.me()!.x)).toBeGreaterThan(290);

  const oreBefore = await ore(page);
  const xpBefore = await miningXp(page);

  await page.evaluate(() => window.__mmo!.gather("copper-1"));

  // One yield lands within a couple of gather cycles (~2.4s each).
  await expect.poll(() => ore(page), { timeout: 12_000 }).toBeGreaterThan(oreBefore);
  expect(await miningXp(page)).toBeGreaterThan(xpBefore);
});
