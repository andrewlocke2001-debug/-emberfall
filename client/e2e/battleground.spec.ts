import { test, expect } from "@playwright/test";
import { enterWorld, enterWorldAsGm, clearBag } from "./helpers";
import type { Page } from "@playwright/test";

const cmd = async (page: Page, text: string): Promise<void> => {
  await page.fill("#chat-input", text);
  await page.press("#chat-input", "Enter");
};
const zone = (page: Page): Promise<string | null> => page.evaluate(() => window.__mmo!.zone());
const count = (page: Page, id: string): Promise<number> =>
  page.evaluate((i) => window.__mmo!.inventory().reduce((n, s) => (s.itemId === i ? n + s.qty : n), 0), id);

// The battleground (P12.2): queue → the matchmaker pops a match into one arena
// instance with teams → cross-team kills score → first to 3 wins coins → all
// sent home. No level bands, no skulls, no item loss: the queue is consent.
test("battleground: queue pops a team match, kills score, winners paid", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.goto("/");
  await enterWorldAsGm(pageA);
  await pageB.goto("/");
  await enterWorld(pageB, "Gladiator");
  await clearBag(pageA);

  // Queue both: the match pops at two and both land in the same arena instance.
  await pageA.evaluate(() => window.__mmo!.bgQueue());
  await expect(pageA.locator("#chat-log")).toContainText("Queued for the battleground", {
    timeout: 10_000,
  });
  await pageB.evaluate(() => window.__mmo!.bgQueue());
  await expect.poll(() => zone(pageA), { timeout: 20_000 }).toBe("bg_arena");
  await expect.poll(() => zone(pageB), { timeout: 20_000 }).toBe("bg_arena");
  expect(await pageA.evaluate(() => window.__mmo!.roomId())).toBe(
    await pageB.evaluate(() => window.__mmo!.roomId()),
  );

  // Teams: first in queue is red, second blue — synced on the schema.
  const aSid = await pageA.evaluate(() => window.__mmo!.sessionId());
  const bSid = await pageB.evaluate(() => window.__mmo!.sessionId());
  expect(await pageA.evaluate((s) => window.__mmo!.playerTeam(s), aSid)).toBe("red");
  expect(await pageA.evaluate((s) => window.__mmo!.playerTeam(s), bSid)).toBe("blue");

  const bName = await pageB.evaluate(() => window.__mmo!.me()!.name);

  // Red (the GM) takes three kills; Blue respawns at their corner between.
  for (let kill = 1; kill <= 3; kill++) {
    await expect
      .poll(() => pageB.evaluate(() => window.__mmo!.me()!.hp), { timeout: 15_000 })
      .toBeGreaterThan(1); // alive (fresh or respawned)
    const bPos = await pageB.evaluate(() => ({ x: window.__mmo!.me()!.x, y: window.__mmo!.me()!.y }));
    await cmd(pageA, `/tp ${Math.round(bPos.x) + 24} ${Math.round(bPos.y)}`);
    await cmd(pageA, `/sethp 2 ${bName}`);
    await expect
      .poll(
        async () => {
          await pageA.evaluate((sid) => window.__mmo!.attack(sid), bSid);
          await pageA.waitForTimeout(1600);
          return pageA.evaluate((sid) => window.__mmo!.playerHp(sid), bSid);
        },
        { timeout: 30_000, intervals: [0] },
      )
      .toBe(0);
    await expect(pageA.locator("#chat-log")).toContainText(`Red ${kill} — Blue 0`, {
      timeout: 10_000,
    });
  }

  // Victory: winners paid, everyone shipped home.
  await expect(pageA.locator("#chat-log")).toContainText("Red wins the battleground", {
    timeout: 10_000,
  });
  await expect.poll(() => count(pageA, "coins"), { timeout: 10_000 }).toBe(150);
  await expect.poll(() => zone(pageA), { timeout: 20_000 }).toBe("meadowbrook");
  await expect.poll(() => zone(pageB), { timeout: 20_000 }).toBe("meadowbrook");

  await ctxA.close();
  await ctxB.close();
});
