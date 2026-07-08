import { test, expect } from "@playwright/test";
import { enterWorldAsGm } from "./helpers";

// The Cinder Depths boss (Warden of Ash) uses a telegraphed AoE slam: it winds
// up a danger circle, then hits everyone still inside. GM /spawn drops one next
// to us so we can prove the wind-up fires and the slam lands.
test("a dungeon boss telegraphs a slam that hits a player standing in it", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);

  await page.fill("#chat-input", "/spawn warden_of_ash");
  await page.press("#chat-input", "Enter");

  // A slam winds up (the telegraph becomes active).
  await expect
    .poll(() => page.evaluate(() => window.__mmo!.telegraphActive()), { timeout: 15_000 })
    .toBe(true);

  // Standing in the circle, the slam lands and takes a chunk of HP.
  const startHp = await page.evaluate(() => window.__mmo!.me()!.hp);
  await expect
    .poll(() => page.evaluate(() => window.__mmo!.me()?.hp ?? 0), { timeout: 15_000 })
    .toBeLessThan(startHp);
});
