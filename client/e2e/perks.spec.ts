import { test, expect } from "@playwright/test";
import { enterWorldAsGm, clearBag } from "./helpers";
import type { Page } from "@playwright/test";

const cmd = async (page: Page, text: string): Promise<void> => {
  await page.fill("#chat-input", text);
  await page.press("#chat-input", "Enter");
};
const coins = (page: Page): Promise<number> =>
  page.evaluate(() => window.__mmo!.inventory().reduce((n, s) => (s.itemId === "coins" ? n + s.qty : n), 0));
const perks = (page: Page): Promise<string[]> => page.evaluate(() => window.__mmo!.perks());
const maxHp = (page: Page): Promise<number> => page.evaluate(() => window.__mmo!.me()!.maxHp);

// Perks (PT.5 skill tree): melee tiers unlock at 5/15/30, one pick per tier,
// stats apply immediately, and a respec burns RESPEC_COST coins (gold sink).
test("perks: tier gating, one pick per tier, juggernaut hp, respec sink", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  await clearBag(page);

  // The GM fixture persists across runs — clear any perks from a prior run
  // (respec needs the fee, so fund it first; refused silently when empty).
  await page.evaluate(() => window.__mmo!.requestPerks());
  if ((await perks(page)).length > 0) {
    await cmd(page, "/give coins 200");
    await page.evaluate(() => window.__mmo!.respecPerks());
    await expect.poll(() => perks(page)).toEqual([]);
    await clearBag(page);
  }

  // Below the first tier's level, picking is refused.
  await cmd(page, "/setlevel 1");
  await expect.poll(() => page.evaluate(() => window.__mmo!.me()!.level)).toBe(1);
  await page.evaluate(() => window.__mmo!.choosePerk("berserker"));
  await expect(page.locator("#chat-log")).toContainText("can't take that perk", { timeout: 10_000 });
  expect(await perks(page)).toEqual([]);

  // At 30, every tier is open. Pick tier 1 — its sibling is then rejected.
  await cmd(page, "/setlevel 30");
  await expect.poll(() => page.evaluate(() => window.__mmo!.me()!.level)).toBe(30);
  await page.evaluate(() => window.__mmo!.choosePerk("berserker"));
  await expect.poll(() => perks(page)).toEqual(["berserker"]);
  await page.evaluate(() => window.__mmo!.choosePerk("guardian"));
  await expect(page.locator("#chat-log")).toContainText("already chosen", { timeout: 10_000 });
  expect(await perks(page)).toEqual(["berserker"]);

  // Juggernaut (tier 3) raises max HP by 40 the moment it's learned.
  const hpBefore = await maxHp(page);
  await page.evaluate(() => window.__mmo!.choosePerk("juggernaut"));
  await expect.poll(() => perks(page)).toEqual(["berserker", "juggernaut"]);
  await expect.poll(() => maxHp(page)).toBe(hpBefore + 40);

  // Respec: refused broke, then burns exactly 200 coins and clears the tiers.
  await page.evaluate(() => window.__mmo!.respecPerks());
  await expect(page.locator("#chat-log")).toContainText("respec costs 200 coins", { timeout: 10_000 });
  await cmd(page, "/give coins 200");
  await expect.poll(() => coins(page)).toBe(200);
  await page.evaluate(() => window.__mmo!.respecPerks());
  await expect.poll(() => perks(page)).toEqual([]);
  await expect.poll(() => coins(page)).toBe(0);
  await expect.poll(() => maxHp(page)).toBe(hpBefore);
});
