import { test, expect } from "@playwright/test";
import { enterWorld } from "./helpers";

test("power strike spends energy", async ({ page }) => {
  await page.goto("/");
  await enterWorld(page, "Striker");

  // Close to the town training dummy (west of spawn) and target it.
  await page.evaluate(() => window.__mmo!.setTarget("dummy-1"));
  await page.evaluate(() => window.__mmo!.move(-1, 0));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__mmo!.move(0, 0));

  const before = await page.evaluate(() => window.__mmo!.energy());
  expect(before).toBeGreaterThan(50);

  await page.evaluate(() => window.__mmo!.useAbility("power_strike", "dummy-1"));

  // Power Strike costs energy, so the pool drops below where it started.
  await expect.poll(() => page.evaluate(() => window.__mmo!.energy())).toBeLessThan(before);
});
