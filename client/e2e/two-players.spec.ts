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

  // Strike on a GCD-spaced cadence until the dummy takes damage. Combat is
  // intentionally noisy (accuracy roll + a 0..max damage roll) and the ~1.5s
  // global cooldown caps how often a swing lands, so fire spaced strikes rather
  // than a quick burst (which lands only ~2 and can whiff both).
  await expect
    .poll(
      async () => {
        await pageA.evaluate(() => window.__mmo!.attack("dummy-1"));
        return pageA.evaluate(() => window.__mmo!.enemyHp("dummy-1"));
      },
      { intervals: Array(12).fill(1600), timeout: 25_000 },
    )
    .toBeLessThan(dummyHpBefore!);

  // Both clients agree on the lowered HP (shared authoritative state).
  await expect
    .poll(() => pageB.evaluate(() => window.__mmo!.enemyHp("dummy-1")))
    .toBeLessThan(dummyHpBefore!);

  await ctxA.close();
  await ctxB.close();
});
