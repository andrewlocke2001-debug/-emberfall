import { test, expect } from "@playwright/test";
import { enterWorld } from "./helpers";

// The Playwright server runs with GM_USERNAMES="GMTest" (see playwright.config),
// so a guest who logs in as "GMTest" is a GM and anyone else is not.

test("a GM can spawn a mob with a slash command", async ({ page }) => {
  await page.goto("/");
  await enterWorld(page, "GMTest");

  const before = await page.evaluate(() => window.__mmo!.enemyCount());
  await page.fill("#chat-input", "/spawn wolf");
  await page.press("#chat-input", "Enter");

  await expect
    .poll(() => page.evaluate(() => window.__mmo!.enemyCount()))
    .toBe(before + 1);
});

test("a non-GM cannot spawn a mob (role-gated)", async ({ page }) => {
  await page.goto("/");
  await enterWorld(page, "Plebeian");

  const before = await page.evaluate(() => window.__mmo!.enemyCount());
  await page.fill("#chat-input", "/spawn wolf");
  await page.press("#chat-input", "Enter");

  // Give the server time to (not) act, then confirm nothing was spawned.
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__mmo!.enemyCount())).toBe(before);
});
