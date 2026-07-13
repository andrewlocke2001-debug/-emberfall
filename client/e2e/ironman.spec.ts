import { test, expect } from "@playwright/test";

const SERVER = "http://localhost:2567";

// Ironman: chosen at registration (checkbox), permanent. No trading, no
// Exchange, and the account is marked on the hiscores.
test("ironman: register via checkbox, trading blocked, hiscores marked", async ({ page }) => {
  const name = `Iron-${Date.now().toString(36).slice(-6)}`;

  await page.goto("/");
  await page.fill("#name", name);
  await page.fill("#password", "iron-secret-123");
  await page.check("#ironman");
  await page.click("#btn-register");
  await page.waitForFunction(() => window.__mmo?.ready === true, undefined, { timeout: 20_000 });
  await page.waitForFunction(() => window.__mmo!.me() !== null, undefined, { timeout: 20_000 });

  // Trading is refused with the ironman message.
  await page.evaluate(() => window.__mmo!.tradeRequest("anyone"));
  await expect(page.locator("#chat-log")).toContainText("Ironmen stand alone", { timeout: 10_000 });

  // The Exchange is closed too (message differs from the vendor-proximity one).
  await page.evaluate(() => window.__mmo!.exchangePost("sell", "copper_ore", 1, 5));
  await expect(page.locator("#chat-log")).toContainText("the Exchange is closed to you", {
    timeout: 10_000,
  });

  // Hiscores carry the ironman flag per row. (A fresh 0-XP account may not
  // crack the top 50 on a busy dev DB, so assert the field on a ranked row and
  // on ours when present.)
  const api = await page.request.get(`${SERVER}/api/hiscores?skill=melee`);
  const body = (await api.json()) as { rows: { name: string; ironman: boolean }[] };
  expect(body.rows.length).toBeGreaterThan(0);
  for (const r of body.rows) expect(typeof r.ironman).toBe("boolean");
  const mine = body.rows.find((r) => r.name === name);
  if (mine) expect(mine.ironman).toBe(true);
  expect(body.rows.find((r) => r.name === "GameMaster")?.ironman).toBe(false);
});
