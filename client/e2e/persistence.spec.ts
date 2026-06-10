import { test, expect } from "@playwright/test";
import { enterWorld } from "./helpers";

test("a character's position survives a reload (persistence)", async ({ page }) => {
  await page.goto("/");
  await enterWorld(page, "Gandalf");

  // Walk to a distinctive spot (away from the default spawn).
  await page.evaluate(() => window.__mmo!.move(1, -1));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__mmo!.move(0, 0));
  await page.waitForTimeout(300);

  const before = await page.evaluate(() => window.__mmo!.me());
  expect(before).not.toBeNull();

  // Reload: a brand-new server session, but the same persisted playerId
  // (localStorage). Give the server a moment to flush the leave-snapshot.
  await page.reload();
  await page.waitForTimeout(800);
  await enterWorld(page, "Gandalf");
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => window.__mmo!.me());
  expect(after).not.toBeNull();

  // Restored where we left off — not reset to the spawn point.
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(20);
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(20);
});
