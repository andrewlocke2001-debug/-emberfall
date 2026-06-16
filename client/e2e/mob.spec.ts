import { test, expect } from "@playwright/test";
import { enterWorld } from "./helpers";

test("an aggressive mob in Greenreach damages a player", async ({ page }) => {
  await page.goto("/");
  // Start directly in Greenreach, where the mobs live (default zone is the
  // safe town). main.ts reads the starting zone from localStorage on enter.
  await page.evaluate(() => localStorage.setItem("mmo:zone", "greenreach"));
  await enterWorld(page, "Scout");

  await expect.poll(() => page.evaluate(() => window.__mmo!.zone())).toBe("greenreach");
  const startHp = await page.evaluate(() => window.__mmo!.me()!.hp);
  expect(startHp).toBeGreaterThan(0);

  // Walk east toward the road wolf's aggro range, then stop so it can close in.
  await page.evaluate(() => window.__mmo!.move(1, 0));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__mmo!.move(0, 0));

  // The wolf chases and hits us — HP drops below where we started.
  await expect
    .poll(() => page.evaluate(() => window.__mmo!.me()?.hp ?? 0), { timeout: 15_000 })
    .toBeLessThan(startHp);
});
