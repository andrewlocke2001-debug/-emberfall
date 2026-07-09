import { test, expect } from "@playwright/test";
import { enterWorld } from "./helpers";
import type { Page } from "@playwright/test";

const cmd = async (page: Page, text: string): Promise<void> => {
  await page.fill("#chat-input", text);
  await page.press("#chat-input", "Enter");
};
const coins = (page: Page): Promise<number> =>
  page.evaluate(() => window.__mmo!.inventory().reduce((n, s) => (s.itemId === "coins" ? n + s.qty : n), 0));
const swordDur = (page: Page): Promise<number | undefined> =>
  page.evaluate(() => window.__mmo!.durability()["bronze_sword"]);

// Runs in single-player (no server) — durability wears the same as multiplayer.
test("gear wears in combat and is repaired at a vendor for coins", async ({ page }) => {
  await page.goto("/?solo");
  await page.evaluate(() => localStorage.removeItem("mmo:solo:v1"));
  await enterWorld(page, "Smith");

  // Equip a sword + get some coins.
  await cmd(page, "/give bronze_sword 1");
  await cmd(page, "/give coins 100");
  await expect.poll(() => coins(page)).toBe(100);
  await page.evaluate(() => window.__mmo!.equip("bronze_sword"));
  await expect.poll(() => page.evaluate(() => window.__mmo!.equipment()["weapon"])).toBe("bronze_sword");

  // Spawn a passive dummy and hit it on the GCD until the sword shows wear.
  await cmd(page, "/spawn dummy");
  // Target the freshly spawned dummy (spawns next to us), not the town's map dummy.
  await expect
    .poll(() => page.evaluate(() => window.__mmo!.enemyIds().some((id) => id.startsWith("sandbox"))))
    .toBe(true);
  const dummyId = await page.evaluate(
    () => window.__mmo!.enemyIds().find((id) => id.startsWith("sandbox"))!,
  );
  // Swing on the GCD; confirm the dummy takes damage (solo combat works)…
  await expect
    .poll(
      async () => {
        await page.evaluate((id) => window.__mmo!.attack(id), dummyId);
        await page.waitForTimeout(1600); // one GCD between swings
        return page.evaluate((id) => window.__mmo!.enemyHp(id), dummyId);
      },
      { timeout: 20_000, intervals: [0] },
    )
    .toBeLessThan(200);
  // …and each landing swing wore the sword.
  expect(await swordDur(page)).toBeLessThan(120);

  const wornCoins = await coins(page);

  // Repair at the town vendor (Bram, 624,432): durability restored, coins spent.
  await cmd(page, "/tp 624 432");
  await page.evaluate(() => window.__mmo!.repair());
  await expect.poll(() => swordDur(page)).toBe(120);
  expect(await coins(page)).toBeLessThan(wornCoins);
});
