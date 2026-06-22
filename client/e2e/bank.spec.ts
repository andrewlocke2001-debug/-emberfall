import { test, expect } from "@playwright/test";
import { enterWorldAsGm } from "./helpers";
import type { Page } from "@playwright/test";

const bagCount = (page: Page, id: string): Promise<number> =>
  page.evaluate(
    (i) => window.__mmo!.inventory().reduce((n, s) => (s.itemId === i ? n + s.qty : n), 0),
    id,
  );
const bankCount = (page: Page, id: string): Promise<number> =>
  page.evaluate((i) => window.__mmo!.bank().reduce((n, s) => (s.itemId === i ? n + s.qty : n), 0), id);

// The Meadowbrook bank sits at (656, 432); GM /tp drops us right on it.
test("deposit to and withdraw from the town bank", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  await page.waitForTimeout(700);

  await page.fill("#chat-input", "/tp 656 432");
  await page.press("#chat-input", "Enter");
  await expect.poll(() => page.evaluate(() => window.__mmo!.atBank())).toBe(true);
  await page.waitForTimeout(500); // let the bank contents sync

  await page.fill("#chat-input", "/give ash_pelt 7");
  await page.press("#chat-input", "Enter");
  await page.waitForTimeout(400);

  const bagBefore = await bagCount(page, "ash_pelt");
  const bankBefore = await bankCount(page, "ash_pelt");

  // Deposit 7 → leaves the bag, lands in the bank.
  await page.evaluate(() => window.__mmo!.deposit("ash_pelt", 7));
  await expect.poll(() => bankCount(page, "ash_pelt")).toBe(bankBefore + 7);
  expect(await bagCount(page, "ash_pelt")).toBe(bagBefore - 7);

  // Withdraw 7 → back in the bag, bank restored (round-trip conserves total).
  await page.evaluate(() => window.__mmo!.withdraw("ash_pelt", 7));
  await expect.poll(() => bagCount(page, "ash_pelt")).toBe(bagBefore);
  expect(await bankCount(page, "ash_pelt")).toBe(bankBefore);
});
