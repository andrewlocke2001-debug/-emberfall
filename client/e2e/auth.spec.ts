import { test, expect } from "@playwright/test";

/**
 * Proves permanent accounts: register, move to a distinct spot, reload, then
 * log back in with the same credentials and land on the same character where
 * we left it. (Guest auth is already exercised by the other specs.)
 */
test("register then log back in to the same character", async ({ page }) => {
  const username = `Tester_${Date.now()}`;
  const password = "hunter2pass";

  await page.goto("/");
  await page.fill("#name", username);
  await page.fill("#password", password);
  await page.click("#btn-register");
  await page.waitForFunction(() => window.__mmo?.ready === true, undefined, { timeout: 20_000 });
  await page.waitForFunction(() => window.__mmo!.me() !== null, undefined, { timeout: 20_000 });

  // Move somewhere distinct, then let the position settle + persist.
  await page.evaluate(() => window.__mmo!.move(1, 0));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__mmo!.move(0, 0));
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.__mmo!.me());
  expect(before).not.toBeNull();

  // Reload (flush the leave-snapshot), then log in with the same credentials.
  await page.reload();
  await page.waitForTimeout(800);
  await page.fill("#name", username);
  await page.fill("#password", password);
  await page.click("#btn-login");
  await page.waitForFunction(() => window.__mmo?.ready === true, undefined, { timeout: 20_000 });
  await page.waitForFunction(() => window.__mmo!.me() !== null, undefined, { timeout: 20_000 });

  const after = await page.evaluate(() => window.__mmo!.me());
  expect(after).not.toBeNull();
  expect(after!.name).toBe(username);
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(20);
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(20);
});
