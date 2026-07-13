import { test, expect } from "@playwright/test";
import { enterWorldAsGm, clearBag } from "./helpers";
import type { Page } from "@playwright/test";

const zone = (page: Page): Promise<string | null> => page.evaluate(() => window.__mmo!.zone());
const count = (page: Page, id: string): Promise<number> =>
  page.evaluate((i) => window.__mmo!.inventory().reduce((n, s) => (s.itemId === i ? n + s.qty : n), 0), id);
async function cmd(page: Page, text: string): Promise<void> {
  await page.fill("#chat-input", text);
  await page.press("#chat-input", "Enter");
}

// Fast travel (P11.2): stand on the Meadowbrook waystone, pay the fee, warp to
// the Greenreach waystone. Off the stone the jump is refused.
test("fast travel between waystones charges a fee and moves zones", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("mmo:zone", "meadowbrook"));
  await enterWorldAsGm(page);
  await clearBag(page);
  await expect.poll(() => zone(page)).toBe("meadowbrook");

  // Off the waystone, travel is refused.
  await cmd(page, "/tp 400 688");
  await page.evaluate(() => window.__mmo!.fastTravel("ws_greenreach"));
  await expect(page.locator("#chat-log")).toContainText("Stand on a waystone", { timeout: 10_000 });
  expect(await zone(page)).toBe("meadowbrook");

  // On the Meadowbrook waystone (its default entry) with coins, the jump works.
  await cmd(page, "/give coins 100");
  await expect.poll(() => count(page, "coins")).toBe(100);
  await cmd(page, "/tp 592 464");
  await page.evaluate(() => window.__mmo!.fastTravel("ws_greenreach"));

  await expect.poll(() => zone(page), { timeout: 20_000 }).toBe("greenreach");
  // The fee left the economy (30 coins sunk).
  await expect.poll(() => count(page, "coins")).toBe(70);
});
