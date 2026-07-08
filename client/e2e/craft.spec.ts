import { test, expect } from "@playwright/test";
import { enterWorldAsGm, clearBag } from "./helpers";
import type { Page } from "@playwright/test";

const count = (page: Page, id: string): Promise<number> =>
  page.evaluate(
    (i) => window.__mmo!.inventory().reduce((n, s) => (s.itemId === i ? n + s.qty : n), 0),
    id,
  );

test("smithing smelts ore into a bronze bar (with Smithing XP)", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  await clearBag(page);
  await page.waitForTimeout(700);

  await page.fill("#chat-input", "/give copper_ore 1");
  await page.press("#chat-input", "Enter");
  await page.fill("#chat-input", "/give tin_ore 1");
  await page.press("#chat-input", "Enter");
  await page.waitForTimeout(400);

  const barsBefore = await count(page, "bronze_bar");
  const xpBefore = await page.evaluate(() => window.__mmo!.me()!.smithingXp);

  await page.evaluate(() => window.__mmo!.craft("smelt_bronze"));

  await expect.poll(() => count(page, "bronze_bar")).toBe(barsBefore + 1);
  // smithingXp is a synced-schema field; its delta can land just after the
  // Inventory message, so poll rather than read once.
  await expect
    .poll(() => page.evaluate(() => window.__mmo!.me()!.smithingXp))
    .toBeGreaterThan(xpBefore);
});

test("cooking turns raw shrimp into food you can eat", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  await clearBag(page);
  await page.waitForTimeout(700);

  await page.fill("#chat-input", "/give raw_shrimp 1");
  await page.press("#chat-input", "Enter");
  await page.waitForTimeout(400);

  const cookedBefore = await count(page, "shrimp");
  await page.evaluate(() => window.__mmo!.craft("cook_shrimp"));
  await expect.poll(() => count(page, "shrimp")).toBe(cookedBefore + 1);

  // Eat one — the food leaves the bag (the heal itself is applied server-side).
  const eatBefore = await count(page, "shrimp");
  await page.evaluate(() => window.__mmo!.consume("shrimp"));
  await expect.poll(() => count(page, "shrimp")).toBe(eatBefore - 1);
});
