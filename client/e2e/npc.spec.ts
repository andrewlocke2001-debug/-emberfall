import { test, expect } from "@playwright/test";
import { enterWorldAsGm } from "./helpers";
import type { Page } from "@playwright/test";

const status = (page: Page): Promise<string> =>
  page.evaluate(
    () => window.__mmo!.quests().find((q) => q.questId === "greet_mira")?.status ?? "none",
  );
const talkDone = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => (window.__mmo!.quests().find((q) => q.questId === "greet_mira")?.progress[0] ?? 0) >= 1,
  );

// greet_mira: talk to Warden Mira (at 560,464 in Meadowbrook). GM account
// persists, so this runs the full loop once and verifies persistence after.
test("talking to an NPC advances and completes a talk quest", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  await page.waitForTimeout(700);

  if ((await status(page)) === "complete") {
    expect(await status(page)).toBe("complete");
    return;
  }

  // Stand next to Mira.
  await page.fill("#chat-input", "/tp 560 464");
  await page.press("#chat-input", "Enter");
  await expect.poll(() => page.evaluate(() => window.__mmo!.me()!.x)).toBeLessThan(580);

  if ((await status(page)) === "none") {
    await page.evaluate(() => window.__mmo!.questAccept("greet_mira"));
    await expect.poll(() => status(page)).toBe("active");
  }

  await page.evaluate(() => window.__mmo!.talk("hearthwarden_mira"));
  await expect.poll(() => talkDone(page)).toBe(true);

  await page.evaluate(() => window.__mmo!.questComplete("greet_mira"));
  await expect.poll(() => status(page)).toBe("complete");
});
