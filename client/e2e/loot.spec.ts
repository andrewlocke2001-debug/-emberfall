import { test, expect } from "@playwright/test";
import { enterWorldAsGm, clearBag } from "./helpers";
import type { Page } from "@playwright/test";

const coins = (page: Page): Promise<number> =>
  page.evaluate(() => window.__mmo!.inventory().reduce((n, s) => (s.itemId === "coins" ? n + s.qty : n), 0));
const coinPile = (page: Page): Promise<{ id: string } | undefined> =>
  page.evaluate(() => window.__mmo!.groundLoot().find((l) => l.itemId === "coins"));

// /droploot puts a pile at the GM's feet (in pickup range), reserved to them.
test("ground loot can be dropped and picked up into the bag", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  await clearBag(page);
  await page.waitForTimeout(700); // let the initial inventory arrive

  const before = await coins(page);

  await page.fill("#chat-input", "/droploot coins 50");
  await page.press("#chat-input", "Enter");

  // The pile appears on the ground (synced state)...
  await expect.poll(() => coinPile(page).then((p) => !!p)).toBe(true);
  const pile = await coinPile(page);

  // ...pick it up; coins land in the bag and the pile is gone.
  await page.evaluate((id) => window.__mmo!.pickup(id), pile!.id);
  await expect.poll(() => coins(page)).toBe(before + 50);
  await expect.poll(() => coinPile(page).then((p) => !!p)).toBe(false);
});
