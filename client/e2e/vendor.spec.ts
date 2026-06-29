import { test, expect } from "@playwright/test";
import { enterWorldAsGm } from "./helpers";
import type { Page } from "@playwright/test";

const count = (page: Page, id: string): Promise<number> =>
  page.evaluate(
    (i) => window.__mmo!.inventory().reduce((n, s) => (s.itemId === i ? n + s.qty : n), 0),
    id,
  );

// Trader Bram stands at (624,432) in Meadowbrook and stocks health_potion
// (value 15 → buy 15, sell 6).
test("buy from and sell to a vendor for coins", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  await page.waitForTimeout(700);

  await page.fill("#chat-input", "/tp 624 432");
  await page.press("#chat-input", "Enter");
  await expect.poll(() => page.evaluate(() => window.__mmo!.me()!.x)).toBeGreaterThan(600);

  await page.fill("#chat-input", "/give coins 100");
  await page.press("#chat-input", "Enter");
  await page.waitForTimeout(400);

  const coins0 = await count(page, "coins");
  const pots0 = await count(page, "health_potion");

  // Buy one potion: 15 coins out, one potion in.
  await page.evaluate(() => window.__mmo!.buy("bram_general", "health_potion", 1));
  await expect.poll(() => count(page, "health_potion")).toBe(pots0 + 1);
  await expect.poll(() => count(page, "coins")).toBe(coins0 - 15);

  // Sell it back: potion out, 6 coins in.
  await page.evaluate(() => window.__mmo!.sell("bram_general", "health_potion", 1));
  await expect.poll(() => count(page, "health_potion")).toBe(pots0);
  await expect.poll(() => count(page, "coins")).toBe(coins0 - 15 + 6);
});
