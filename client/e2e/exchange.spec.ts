import { test, expect } from "@playwright/test";
import { enterWorldAsGm, clearBag } from "./helpers";
import type { Page } from "@playwright/test";

const count = (page: Page, id: string): Promise<number> =>
  page.evaluate((i) => window.__mmo!.inventory().reduce((n, s) => (s.itemId === i ? n + s.qty : n), 0), id);
const cmd = async (page: Page, text: string): Promise<void> => {
  await page.fill("#chat-input", text);
  await page.press("#chat-input", "Enter");
};

// The Exchange: post a sell (items escrow off the bag), a crossing buy fills it
// instantly, both sides collect (items to the buyer, coins minus the 2% tax to
// the seller). Self-trade through the book exercises the whole pipeline with
// one account. Then a cancel returns escrow.
test("post, match, collect (with tax), and cancel on the Exchange", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  await clearBag(page);

  // The GM account persists orders across runs — clear its book so the counts
  // below are exact (cancel refunds escrow into the now-empty bag).
  await page.evaluate(() => window.__mmo!.requestExchange());
  await page.waitForTimeout(300);
  for (let i = 0; i < 12; i++) {
    const orders = await page.evaluate(() => window.__mmo!.exchange().orders);
    if (orders.length === 0) break;
    for (const o of orders) await page.evaluate((id) => window.__mmo!.exchangeCancel(id), o.id);
    await page.waitForTimeout(200);
    await clearBag(page); // discard refunded escrow so it can't skew later counts
  }
  await expect.poll(() => page.evaluate(() => window.__mmo!.exchange().orders.length)).toBe(0);

  // Stand at the vendor (the Exchange clerk) with goods + coins.
  await cmd(page, "/tp 624 432");
  await cmd(page, "/give iron_ore 5");
  await cmd(page, "/give coins 200");
  await expect.poll(() => count(page, "iron_ore")).toBe(5);
  await expect.poll(() => count(page, "coins")).toBe(200);

  // Sell 5 @ 10 → ore escrows out of the bag.
  await page.evaluate(() => window.__mmo!.exchangePost("sell", "iron_ore", 5, 10));
  await expect.poll(() => count(page, "iron_ore")).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__mmo!.exchange().orders.length)).toBe(1);

  // Buy 5 @ 10 → 50 coins escrow; the orders cross and fill instantly.
  await page.evaluate(() => window.__mmo!.exchangePost("buy", "iron_ore", 5, 10));
  await expect.poll(() => count(page, "coins")).toBe(150);
  await expect
    .poll(() => page.evaluate(() => window.__mmo!.exchange().orders.every((o) => o.remaining === 0)))
    .toBe(true);

  // Collect both orders: buyer gets 5 ore; seller gets 50 − 2% tax = 49 coins.
  const ids = await page.evaluate(() => window.__mmo!.exchange().orders.map((o) => o.id));
  for (const id of ids) await page.evaluate((i) => window.__mmo!.exchangeCollect(i), id);
  await expect.poll(() => count(page, "iron_ore")).toBe(5);
  await expect.poll(() => count(page, "coins")).toBe(150 + 49);
  // Fully-settled orders disappear.
  await expect.poll(() => page.evaluate(() => window.__mmo!.exchange().orders.length)).toBe(0);

  // The trade hit the price history.
  await page.evaluate(() => window.__mmo!.requestExchange("iron_ore"));
  await expect
    .poll(() => page.evaluate(() => window.__mmo!.exchange().prices?.[0]?.price ?? 0))
    .toBe(10);

  // Cancel path: post a sell, cancel it, escrow comes back.
  await page.evaluate(() => window.__mmo!.exchangePost("sell", "iron_ore", 5, 99));
  await expect.poll(() => count(page, "iron_ore")).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__mmo!.exchange().orders.length)).toBe(1);
  const cancelId = await page.evaluate(() => window.__mmo!.exchange().orders[0]!.id);
  await page.evaluate((i) => window.__mmo!.exchangeCancel(i), cancelId);
  await expect.poll(() => count(page, "iron_ore")).toBe(5);
  await expect.poll(() => page.evaluate(() => window.__mmo!.exchange().orders.length)).toBe(0);
});
