import { test, expect } from "@playwright/test";
import { enterWorldAsGm } from "./helpers";

// Achievements are computed from persisted state; titles are wearable only
// when their achievement is unlocked. GameMaster has completed quests over the
// suite's history, so first_quest is unlocked; melee_40 (level 40) is not.
test("achievements unlock from state; titles are gated + synced", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  const sid = await page.evaluate(() => window.__mmo!.sessionId());

  // The shared GM fixture's Melee level drifts up across suite history (raid
  // kills etc.) — pin it below 40 so the locked/unlocked split is stable.
  await page.fill("#chat-input", "/setlevel 10");
  await page.press("#chat-input", "Enter");
  await expect.poll(() => page.evaluate(() => window.__mmo!.me()!.level)).toBe(10);

  await page.evaluate(() => window.__mmo!.requestAchievements());
  await expect
    .poll(() => page.evaluate(() => window.__mmo!.achievements().list.length))
    .toBeGreaterThan(0);
  const list = await page.evaluate(() => window.__mmo!.achievements().list);
  expect(list.find((a) => a.id === "first_quest")?.unlocked).toBe(true);
  expect(list.find((a) => a.id === "melee_10")?.unlocked).toBe(true);
  expect(list.find((a) => a.id === "melee_40")?.unlocked).toBe(false);

  // A locked title is refused; an unlocked one is worn and synced.
  await page.evaluate(() => window.__mmo!.setTitle("melee_40"));
  await page.waitForTimeout(500);
  expect(await page.evaluate((s) => window.__mmo!.playerTitle(s), sid)).toBe("");
  await page.evaluate(() => window.__mmo!.setTitle("first_quest"));
  await expect
    .poll(() => page.evaluate((s) => window.__mmo!.playerTitle(s), sid))
    .toBe("the Initiate");

  // Clearing works.
  await page.evaluate(() => window.__mmo!.setTitle(""));
  await expect.poll(() => page.evaluate((s) => window.__mmo!.playerTitle(s), sid)).toBe("");
});
