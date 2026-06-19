import { test, expect } from "@playwright/test";
import { enterWorld, enterWorldAsGm } from "./helpers";

// The Playwright server runs with GM_USERNAMES="GameMaster" (see
// playwright.config); enterWorldAsGm logs into that registered account, anyone
// else (a guest) is not a GM.

test("a GM can spawn a mob with a slash command", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);

  const before = await page.evaluate(() => window.__mmo!.enemyCount());
  await page.fill("#chat-input", "/spawn dummy");
  await page.press("#chat-input", "Enter");

  await expect
    .poll(() => page.evaluate(() => window.__mmo!.enemyCount()))
    .toBe(before + 1);
});

test("a non-GM cannot spawn a mob (role-gated)", async ({ page }) => {
  await page.goto("/");
  await enterWorld(page, "Plebeian");

  const before = await page.evaluate(() => window.__mmo!.enemyCount());
  await page.fill("#chat-input", "/spawn dummy");
  await page.press("#chat-input", "Enter");

  // Give the server time to (not) act, then confirm nothing was spawned.
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__mmo!.enemyCount())).toBe(before);
});
