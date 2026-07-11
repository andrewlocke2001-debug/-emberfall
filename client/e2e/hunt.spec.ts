import { test, expect } from "@playwright/test";
import { enterWorldAsGm, clearBag } from "./helpers";
import type { Page } from "@playwright/test";

const cmd = async (page: Page, text: string): Promise<void> => {
  await page.fill("#chat-input", text);
  await page.press("#chat-input", "Enter");
};
const count = (page: Page, id: string): Promise<number> =>
  page.evaluate((i) => window.__mmo!.inventory().reduce((n, s) => (s.itemId === i ? n + s.qty : n), 0), id);

// Hunts: take a task at Huntmaster Veyra, cull the target (GM /spawn + /weaken
// make each kill two strikes), earn points, spend them in the point shop.
test("hunt: assign, cull the target, earn points, buy from the shop", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/");
  await enterWorldAsGm(page);
  await clearBag(page);

  // Gear up — high-defence targets (sentinels/wraiths) need real accuracy.
  await cmd(page, "/give iron_sword 1");
  await cmd(page, "/give cinder_heart 1");
  await expect.poll(() => count(page, "iron_sword")).toBe(1);
  await page.evaluate(() => window.__mmo!.equip("iron_sword"));
  await page.evaluate(() => window.__mmo!.equip("cinder_heart"));
  await expect
    .poll(() => page.evaluate(() => window.__mmo!.equipment()["weapon"]))
    .toBe("iron_sword");

  // At Veyra: take a task — or resume the persisted one from a prior run.
  await cmd(page, "/tp 592 464");
  await page.evaluate(() => window.__mmo!.requestHunt());
  await page.waitForTimeout(500);
  if (await page.evaluate(() => window.__mmo!.hunt().task === null)) {
    await page.evaluate(() => window.__mmo!.huntAssign());
  }
  await expect
    .poll(() => page.evaluate(() => window.__mmo!.hunt().task !== null))
    .toBe(true);
  const task = await page.evaluate(() => window.__mmo!.hunt().task!);
  const startPoints = await page.evaluate(() => window.__mmo!.hunt().points);

  // Cull one at a time (gm-* ids): spawn, weaken by id, strike down, heal up.
  const seen: string[] = await page.evaluate(() => window.__mmo!.enemyIds());
  for (let i = 0; i < task.remaining; i++) {
    await cmd(page, "/heal"); // stray aggro from spawned/respawned mobs
    await cmd(page, `/spawn ${task.mob}`);
    await expect
      .poll(() =>
        page.evaluate(
          (prev) => window.__mmo!.enemyIds().some((x) => x.startsWith("gm-") && !prev.includes(x)),
          seen,
        ),
      )
      .toBe(true);
    const id = await page.evaluate(
      (prev) => window.__mmo!.enemyIds().find((x) => x.startsWith("gm-") && !prev.includes(x))!,
      seen,
    );
    seen.push(id);
    await cmd(page, `/weaken ${id}`);
    await expect
      .poll(
        async () => {
          await page.evaluate((eid) => window.__mmo!.attack(eid), id);
          await page.waitForTimeout(1600);
          return page.evaluate((eid) => window.__mmo!.enemyHp(eid), id);
        },
        { timeout: 20_000, intervals: [0] },
      )
      .toBe(0);
  }

  // Completion paid points; the shop converts them into a potion.
  await expect.poll(() => page.evaluate(() => window.__mmo!.hunt().task)).toBeNull();
  const points = await page.evaluate(() => window.__mmo!.hunt().points);
  expect(points).toBeGreaterThan(startPoints);
  const potsBefore = await count(page, "health_potion");
  await page.evaluate(() => window.__mmo!.huntBuy("health_potion"));
  await expect.poll(() => count(page, "health_potion")).toBe(potsBefore + 1);
  await expect.poll(() => page.evaluate(() => window.__mmo!.hunt().points)).toBe(points - 5);
});
