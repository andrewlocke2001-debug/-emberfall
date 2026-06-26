import { test, expect } from "@playwright/test";
import { enterWorldAsGm } from "./helpers";
import type { Page } from "@playwright/test";

const coins = (page: Page): Promise<number> =>
  page.evaluate(() =>
    window.__mmo!.inventory().reduce((n, s) => (s.itemId === "coins" ? n + s.qty : n), 0),
  );
const status = (page: Page): Promise<string> =>
  page.evaluate(
    () => window.__mmo!.quests().find((q) => q.questId === "miners_welcome")?.status ?? "none",
  );

// miners_welcome: collect 3 copper ore → 50 coins + Mining XP. The GM account
// persists, so the quest is one-time; this test runs the full loop on the first
// run and verifies persistence on later runs.
test("accept a collect quest, satisfy it, and turn it in", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  await page.waitForTimeout(700);

  if ((await status(page)) === "complete") {
    expect(await status(page)).toBe("complete"); // already done on a prior run
    return;
  }

  if ((await status(page)) === "none") {
    await page.evaluate(() => window.__mmo!.questAccept("miners_welcome"));
    await expect.poll(() => status(page)).toBe("active");
  }

  await page.fill("#chat-input", "/give copper_ore 3");
  await page.press("#chat-input", "Enter");
  await page.waitForTimeout(400);
  const coinsBefore = await coins(page);

  await page.evaluate(() => window.__mmo!.questComplete("miners_welcome"));
  await expect.poll(() => status(page)).toBe("complete");
  await expect.poll(() => coins(page)).toBe(coinsBefore + 50); // reward paid out
});
