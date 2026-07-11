import { test, expect } from "@playwright/test";
import { enterWorld, enterWorldAsGm, clearBag } from "./helpers";
import type { Page } from "@playwright/test";

const count = (page: Page, id: string): Promise<number> =>
  page.evaluate((i) => window.__mmo!.inventory().reduce((n, s) => (s.itemId === i ? n + s.qty : n), 0), id);

// The Ashreach: open PvP with anti-grief. Spawn protection blocks the first
// gank; attacking skulls the aggressor; a kill drops the victim's most
// valuable items + coins as lootable piles.
test("Ashreach PvP: spawn protection, skull, and death drops", async ({ browser }) => {
  test.setTimeout(90_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  // Both start in the Ashreach.
  await pageA.goto("/");
  await pageA.evaluate(() => localStorage.setItem("mmo:zone", "ashreach"));
  await enterWorldAsGm(pageA);
  await pageB.goto("/");
  await pageB.evaluate(() => localStorage.setItem("mmo:zone", "ashreach"));
  await enterWorld(pageB, "Raider");

  const aSid = await pageA.evaluate(() => window.__mmo!.sessionId());
  const bSid = await pageB.evaluate(() => window.__mmo!.sessionId());

  // Spawn protection: B just joined, so A's immediate attack is blocked (a
  // blocked attack also doesn't skull). A's own protection lapsed during its
  // longer login flow.
  const bPos = await pageB.evaluate(() => ({ x: window.__mmo!.me()!.x, y: window.__mmo!.me()!.y }));
  await pageA.fill("#chat-input", `/tp ${Math.round(bPos.x) + 20} ${Math.round(bPos.y)}`);
  await pageA.press("#chat-input", "Enter");
  await pageA.evaluate((sid) => window.__mmo!.attack(sid), bSid);
  await pageA.waitForTimeout(1000);
  expect(await pageA.evaluate((sid) => window.__mmo!.playerHp(sid), bSid)).toBe(100);
  expect(await pageB.evaluate((sid) => window.__mmo!.playerSkull(sid), aSid)).toBe(0);

  // A: valuables to lose.
  await clearBag(pageA);
  await pageA.fill("#chat-input", "/give iron_ore 3");
  await pageA.press("#chat-input", "Enter");
  await pageA.fill("#chat-input", "/give coins 50");
  await pageA.press("#chat-input", "Enter");
  await expect.poll(() => count(pageA, "coins")).toBe(50);

  // Let B's protection lapse, weaken A, then B attacks for real (no duel).
  await pageB.waitForTimeout(10_500);
  await pageA.fill("#chat-input", "/sethp 2");
  await pageA.press("#chat-input", "Enter");
  await expect
    .poll(
      async () => {
        await pageB.evaluate((sid) => window.__mmo!.attack(sid), aSid);
        await pageB.waitForTimeout(1600);
        return pageB.evaluate((sid) => window.__mmo!.playerHp(sid), aSid);
      },
      { timeout: 40_000, intervals: [0] },
    )
    .toBe(0);

  // B is skulled for the aggression; A's valuables are on the ground.
  expect(await pageA.evaluate((sid) => window.__mmo!.playerSkull(sid), bSid)).toBeGreaterThan(0);
  await expect.poll(() => count(pageA, "coins")).toBe(0);
  await expect
    .poll(() => pageB.evaluate(() => window.__mmo!.groundLoot().length))
    .toBeGreaterThan(0);

  // The killer loots the coins.
  const pile = await pageB.evaluate(() => window.__mmo!.groundLoot().find((l) => l.itemId === "coins"));
  expect(pile).toBeTruthy();
  await pageB.evaluate((id) => window.__mmo!.pickup(id), pile!.id);
  await expect.poll(() => count(pageB, "coins")).toBe(50);

  await ctxA.close();
  await ctxB.close();
});
