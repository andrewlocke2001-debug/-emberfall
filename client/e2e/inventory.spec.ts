import { test, expect } from "@playwright/test";
import { enterWorldAsGm } from "./helpers";

/** Total quantity of an item across the player's inventory stacks. */
function count(page: import("@playwright/test").Page, itemId: string): Promise<number> {
  return page.evaluate(
    (id) => window.__mmo!.inventory().reduce((n, s) => (s.itemId === id ? n + s.qty : n), 0),
    itemId,
  );
}

// The GM account ("GameMaster") persists across runs, so its bag may already
// hold items — these tests assert on the *delta* a /give produces, never an
// exact inventory.

test("GM /give creates items in the bag", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  await page.waitForTimeout(700); // let the initial inventory message arrive

  const before = await count(page, "ash_pelt");
  await page.fill("#chat-input", "/give ash_pelt 5");
  await page.press("#chat-input", "Enter");

  await expect.poll(() => count(page, "ash_pelt")).toBe(before + 5);
});

test("inventory survives a reload (persistence)", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page);
  await page.waitForTimeout(700); // let the initial inventory message arrive

  const before = await count(page, "health_potion");
  await page.fill("#chat-input", "/give health_potion 3");
  await page.press("#chat-input", "Enter");
  await expect.poll(() => count(page, "health_potion")).toBe(before + 3);

  // Reload: new server session, same account. Give the leave-snapshot a moment
  // to flush before logging back in (mirrors persistence.spec).
  await page.reload();
  await page.waitForTimeout(800);
  await enterWorldAsGm(page);

  // Poll (don't fixed-wait) so the assertion waits for the inventory message
  // after the re-login rather than racing it.
  await expect.poll(() => count(page, "health_potion")).toBe(before + 3);
});
