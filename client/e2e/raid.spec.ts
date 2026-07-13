import { test, expect } from "@playwright/test";
import { enterWorldAsGm, clearBag } from "./helpers";
import type { Page } from "@playwright/test";

const cmd = async (page: Page, text: string): Promise<void> => {
  await page.fill("#chat-input", text);
  await page.press("#chat-input", "Enter");
};
const count = (page: Page, id: string): Promise<number> =>
  page.evaluate((i) => window.__mmo!.inventory().reduce((n, s) => (s.itemId === i ? n + s.qty : n), 0), id);
const zone = (page: Page): Promise<string | null> => page.evaluate(() => window.__mmo!.zone());

// The Molten Throne (P12.1): enter through the Ashreach gate into an instanced
// run, climb the five-boss chain-spawned gauntlet (each kill wakes the next),
// and fell the Molten King for the lockout-gated relic.
const BOSSES = [
  { kind: "magmar_broodmother", x: 464, y: 1872 },
  { kind: "obsidian_colossus", x: 464, y: 1488 },
  { kind: "pyre_shade", x: 464, y: 1104 },
  { kind: "herald_of_cinders", x: 464, y: 720 },
  { kind: "molten_king", x: 464, y: 304 },
];

test("the Molten Throne: five-boss gauntlet ends in the weekly relic", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("mmo:zone", "ashreach"));
  await enterWorldAsGm(page);
  await clearBag(page);
  await cmd(page, "/raidreset"); // the GM fixture persists lockouts across runs

  // Gear up — raid bosses have real defence.
  await cmd(page, "/give iron_sword 1");
  await cmd(page, "/give cinder_heart 1");
  await expect.poll(() => count(page, "iron_sword")).toBe(1);
  await page.evaluate(() => window.__mmo!.equip("iron_sword"));
  await page.evaluate(() => window.__mmo!.equip("cinder_heart"));

  // Step onto the north gate → the instanced raid.
  await cmd(page, "/tp 784 72");
  await cmd(page, "/tp 784 40");
  await expect.poll(() => zone(page), { timeout: 20_000 }).toBe("molten_throne");

  // Only the first boss exists; each kill wakes the next.
  for (const boss of BOSSES) {
    const id = `raid-${boss.kind}`;
    await expect
      .poll(() => page.evaluate((eid) => window.__mmo!.enemyIds().includes(eid), id), {
        timeout: 15_000,
      })
      .toBe(true);
    // Stand beside it, soften it, and strike on the GCD (healing through hits).
    await cmd(page, `/tp ${boss.x + 44} ${boss.y}`);
    await cmd(page, `/weaken ${id}`);
    await expect
      .poll(
        async () => {
          await cmd(page, "/heal"); // bosses hit hard; the fixture must survive
          await page.evaluate((eid) => window.__mmo!.attack(eid), id);
          await page.waitForTimeout(1600);
          return page.evaluate((eid) => window.__mmo!.enemyHp(eid), id);
        },
        { timeout: 40_000, intervals: [0] },
      )
      .toBe(0);
  }

  // The relic lands in the bag, with the weekly lockout announced.
  await expect.poll(() => count(page, "molten_relic"), { timeout: 10_000 }).toBe(1);
  await expect(page.locator("#chat-log")).toContainText("Locked out for a week");
  await expect(page.locator("#chat-log")).toContainText("The Molten Throne is broken");
});
