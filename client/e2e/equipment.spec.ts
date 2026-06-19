import { test, expect } from "@playwright/test";
import { enterWorldAsGm } from "./helpers";
import type { Page } from "@playwright/test";

const bodyItem = (page: Page): Promise<string | null> =>
  page.evaluate(() => window.__mmo!.equipment()["body"] ?? null);
const maxHp = (page: Page): Promise<number> => page.evaluate(() => window.__mmo!.me()!.maxHp);

// leather_body grants +6 maxHp (and +4 defence) — see shared/data/items.ts.
// GameMaster's gear persists across runs, so start from an empty body slot.
test("equipping body armor raises maxHp; unequipping restores it", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  await page.waitForTimeout(700); // let the initial inventory/equipment arrive

  if (await bodyItem(page)) {
    await page.evaluate(() => window.__mmo!.unequip("body"));
    await expect.poll(() => bodyItem(page)).toBeNull();
  }

  await page.fill("#chat-input", "/give leather_body");
  await page.press("#chat-input", "Enter");
  await page.waitForTimeout(400);
  const bare = await maxHp(page);

  await page.evaluate(() => window.__mmo!.equip("leather_body"));
  await expect.poll(() => bodyItem(page)).toBe("leather_body");
  // maxHp is a synced-schema field; its delta can land just after the Equipment
  // message, so poll rather than read once.
  await expect.poll(() => maxHp(page)).toBe(bare + 6);

  await page.evaluate(() => window.__mmo!.unequip("body"));
  await expect.poll(() => bodyItem(page)).toBeNull();
  await expect.poll(() => maxHp(page)).toBe(bare);
});
