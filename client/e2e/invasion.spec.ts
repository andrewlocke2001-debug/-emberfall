import { test, expect } from "@playwright/test";
import { enterWorldAsGm } from "./helpers";
import type { Page } from "@playwright/test";

const cmd = async (page: Page, text: string): Promise<void> => {
  await page.fill("#chat-input", text);
  await page.press("#chat-input", "Enter");
};

// World events (P12.3): an invasion warband storms the zone gate; slaying the
// Invasion Herald repels it and the warband scatters (event spawns removed).
test("a zone invasion spawns at the gate and is repelled by killing the herald", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("mmo:zone", "greenreach"));
  await enterWorldAsGm(page);

  // Force the event (the schedule is 15 minutes).
  await cmd(page, "/invasion");
  await expect(page.locator("#chat-log")).toContainText("An invasion!", { timeout: 10_000 });
  await expect
    .poll(() => page.evaluate(() => window.__mmo!.enemyIds().includes("inv-herald")))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => window.__mmo!.enemyIds().filter((x) => x.startsWith("inv-escort-")).length),
    )
    .toBe(4);

  // A second trigger is refused while it runs.
  await cmd(page, "/invasion");
  await expect(page.locator("#chat-log")).toContainText("already underway", { timeout: 10_000 });

  // Slay the herald (soften first), standing beside it at the gate.
  await cmd(page, "/tp 256 1008"); // greenreach default entry (208,1008) + offset
  await cmd(page, "/weaken inv-herald");
  await expect
    .poll(
      async () => {
        await cmd(page, "/heal"); // the warband hits back
        await page.evaluate(() => window.__mmo!.attack("inv-herald"));
        await page.waitForTimeout(1600);
        return page.evaluate(() => window.__mmo!.enemyHp("inv-herald"));
      },
      { timeout: 40_000, intervals: [0] },
    )
    .toBe(0);

  // Repelled: announcement + all event spawns cleaned up.
  await expect(page.locator("#chat-log")).toContainText("The invasion is repelled", {
    timeout: 10_000,
  });
  await expect
    .poll(
      () => page.evaluate(() => window.__mmo!.enemyIds().filter((x) => x.startsWith("inv-")).length),
      { timeout: 10_000 },
    )
    .toBe(0);
});
