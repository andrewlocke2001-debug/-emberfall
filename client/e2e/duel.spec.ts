import { test, expect } from "@playwright/test";
import { enterWorld, enterWorldAsGm, clearBag } from "./helpers";

// Duels: consensual PvP, no item loss. A (GM) challenges B, B accepts, A's
// strikes damage B (PvP damage only works inside the duel), /sethp makes the
// finish fast, and the win is announced.
test("a duel: challenge, accept, PvP damage, victory announced", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.goto("/");
  await enterWorldAsGm(pageA);
  await pageB.goto("/");
  await enterWorld(pageB, "Duelist");

  await clearBag(pageA);
  const bName = await pageB.evaluate(() => window.__mmo!.me()!.name);
  const bSid = await pageB.evaluate(() => window.__mmo!.sessionId());
  const bPos = await pageB.evaluate(() => ({ x: window.__mmo!.me()!.x, y: window.__mmo!.me()!.y }));

  // Stand next to B; PvP attack BEFORE any duel must do nothing.
  await pageA.fill("#chat-input", `/tp ${Math.round(bPos.x) + 20} ${Math.round(bPos.y)}`);
  await pageA.press("#chat-input", "Enter");
  await pageA.evaluate((sid) => window.__mmo!.attack(sid), bSid);
  await pageA.waitForTimeout(1000);
  expect(await pageB.evaluate(() => window.__mmo!.me()!.hp)).toBe(100);

  // Challenge + accept.
  await pageA.evaluate((n) => window.__mmo!.duelRequest(n), bName);
  await expect(pageB.locator("#chat-log")).toContainText("challenges you to a duel", { timeout: 10_000 });
  await pageB.evaluate(() => window.__mmo!.duelRespond(true));
  await expect(pageA.locator("#chat-log")).toContainText("are dueling", { timeout: 10_000 });

  // Weaken B (GM test hook) then land the finishing blows on the GCD.
  await pageA.fill("#chat-input", `/sethp 5 ${bName}`);
  await pageA.press("#chat-input", "Enter");
  // Keep striking on the GCD until the killing blow lands + is announced.
  await expect
    .poll(
      async () => {
        await pageA.evaluate((sid) => window.__mmo!.attack(sid), bSid);
        await pageA.waitForTimeout(1600);
        return pageA.evaluate(
          () => (document.getElementById("chat-log")?.textContent ?? "").includes("defeated"),
        );
      },
      { timeout: 40_000, intervals: [0] },
    )
    .toBe(true);

  // No item loss; B respawns with full HP.
  await expect
    .poll(() => pageB.evaluate(() => window.__mmo!.me()!.hp), { timeout: 10_000 })
    .toBe(100);

  await ctxA.close();
  await ctxB.close();
});
