import { test, expect } from "@playwright/test";
import { enterWorldAsGm, clearBag } from "./helpers";
import type { Page } from "@playwright/test";

const cmd = async (page: Page, text: string): Promise<void> => {
  await page.fill("#chat-input", text);
  await page.press("#chat-input", "Enter");
};
const count = (page: Page, id: string): Promise<number> =>
  page.evaluate((i) => window.__mmo!.inventory().reduce((n, s) => (s.itemId === i ? n + s.qty : n), 0), id);

// Mounts (P11): buy at the Stabler (a coin sink), ride for a speed boost,
// and dismount automatically on attacking.
test("mount: buy at the stabler, ride faster, dismount on attack", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  await clearBag(page);
  const sid = await page.evaluate(() => window.__mmo!.sessionId());
  // The GM fixture persists across runs — start from a known unowned state.
  await cmd(page, "/resetmount");
  await expect.poll(() => page.evaluate(() => window.__mmo!.mountOwned())).toBe(false);

  // Away from the stabler (an open tile), buying is refused.
  await cmd(page, "/tp 400 688");
  await page.evaluate(() => window.__mmo!.buyMount());
  await expect(page.locator("#chat-log")).toContainText("Find Bran the Stabler", { timeout: 10_000 });
  expect(await page.evaluate(() => window.__mmo!.mountOwned())).toBe(false);

  // At the stabler with enough coins, the purchase succeeds and sinks 500.
  await cmd(page, "/tp 624 528");
  await cmd(page, "/give coins 500");
  await expect.poll(() => count(page, "coins")).toBe(500);
  await page.evaluate(() => window.__mmo!.buyMount());
  await expect.poll(() => page.evaluate(() => window.__mmo!.mountOwned())).toBe(true);
  await expect.poll(() => count(page, "coins")).toBe(0);

  // Ride: measure travel distance over a short window mounted vs on foot from
  // the open map centre (a short window keeps us clear of any wall).
  const LANE_X = 400;
  const LANE_Y = 688; // a long clear east–west lane in meadowbrook
  const runFor = async (ms: number): Promise<number> => {
    await cmd(page, `/tp ${LANE_X} ${LANE_Y}`);
    await page.waitForTimeout(150);
    const start = await page.evaluate(() => ({ x: window.__mmo!.me()!.x, y: window.__mmo!.me()!.y }));
    await page.evaluate(() => window.__mmo!.move(1, 0));
    await page.waitForTimeout(ms);
    await page.evaluate(() => window.__mmo!.move(0, 0));
    const end = await page.evaluate(() => ({ x: window.__mmo!.me()!.x, y: window.__mmo!.me()!.y }));
    return Math.abs(end.x - start.x);
  };

  // Ensure mounted, then a foot run for comparison.
  if (!(await page.evaluate((s) => window.__mmo!.playerMounted(s), sid))) {
    await page.evaluate(() => window.__mmo!.toggleMount());
  }
  await expect.poll(() => page.evaluate((s) => window.__mmo!.playerMounted(s), sid)).toBe(true);
  const mountedDist = await runFor(300);

  await page.evaluate(() => window.__mmo!.toggleMount());
  await expect.poll(() => page.evaluate((s) => window.__mmo!.playerMounted(s), sid)).toBe(false);
  const footDist = await runFor(300);

  // Mounted travel is meaningfully faster (1.6×; allow slack for tick jitter).
  expect(mountedDist).toBeGreaterThan(footDist * 1.3);

  // Attacking dismounts you. Remount, spawn a dummy, strike it.
  await page.evaluate(() => window.__mmo!.toggleMount());
  await expect.poll(() => page.evaluate((s) => window.__mmo!.playerMounted(s), sid)).toBe(true);
  await cmd(page, "/spawn wolf");
  await expect
    .poll(() => page.evaluate(() => window.__mmo!.enemyIds().some((x) => x.startsWith("gm-"))))
    .toBe(true);
  const foe = await page.evaluate(() => window.__mmo!.enemyIds().find((x) => x.startsWith("gm-"))!);
  await page.evaluate((id) => window.__mmo!.attack(id), foe);
  await expect.poll(() => page.evaluate((s) => window.__mmo!.playerMounted(s), sid)).toBe(false);
});
