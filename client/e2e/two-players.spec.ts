import { test, expect } from "@playwright/test";
import { enterWorld } from "./helpers";

test("two players share a zone and combat lowers the dummy's HP for both", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.goto("/");
  await enterWorld(pageA, "Aragorn");
  await pageB.goto("/");
  await enterWorld(pageB, "Boromir");

  // Both clients should observe the same two players in the shared room.
  await expect.poll(() => pageA.evaluate(() => window.__mmo!.playerCount())).toBe(2);
  await expect.poll(() => pageB.evaluate(() => window.__mmo!.playerCount())).toBe(2);

  const dummyHpBefore = await pageA.evaluate(() => window.__mmo!.enemyHp("dummy-1"));
  expect(dummyHpBefore).not.toBeNull();
  expect(dummyHpBefore!).toBeGreaterThan(0);

  // Close the gap to the dummy (it sits west of the town spawn), then strike.
  await pageA.evaluate(() => window.__mmo!.setTarget("dummy-1"));
  await pageA.evaluate(() => window.__mmo!.move(-1, 0));
  await pageA.waitForTimeout(1000);
  await pageA.evaluate(() => window.__mmo!.move(0, 0));

  for (let i = 0; i < 8; i++) {
    await pageA.evaluate(() => window.__mmo!.attack("dummy-1"));
    await pageA.waitForTimeout(250);
  }

  // The dummy's HP dropped — and both clients agree (shared authoritative state).
  await expect
    .poll(() => pageA.evaluate(() => window.__mmo!.enemyHp("dummy-1")))
    .toBeLessThan(dummyHpBefore!);
  await expect
    .poll(() => pageB.evaluate(() => window.__mmo!.enemyHp("dummy-1")))
    .toBeLessThan(dummyHpBefore!);

  await ctxA.close();
  await ctxB.close();
});
