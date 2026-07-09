import { test, expect } from "@playwright/test";
import { enterWorld, enterWorldAsGm, clearBag } from "./helpers";
import type { Page } from "@playwright/test";

const count = (page: Page, id: string): Promise<number> =>
  page.evaluate((i) => window.__mmo!.inventory().reduce((n, s) => (s.itemId === i ? n + s.qty : n), 0), id);

// A = GameMaster (can /give), B = a guest. A trades a sword to B; the secure
// swap moves it atomically with double confirmation.
test("two players trade an item with confirm-twice + atomic swap", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.goto("/");
  await enterWorldAsGm(pageA);
  await pageB.goto("/");
  await enterWorld(pageB, "Trader");

  const aName = await pageA.evaluate(() => window.__mmo!.me()!.name);
  const bName = await pageB.evaluate(() => window.__mmo!.me()!.name);
  const bPos = await pageB.evaluate(() => ({ x: window.__mmo!.me()!.x, y: window.__mmo!.me()!.y }));

  // A: clean bag, get a sword, stand next to B.
  await clearBag(pageA);
  await pageA.fill("#chat-input", "/give bronze_sword 1");
  await pageA.press("#chat-input", "Enter");
  await expect.poll(() => count(pageA, "bronze_sword")).toBe(1);
  await pageA.fill("#chat-input", `/tp ${Math.round(bPos.x)} ${Math.round(bPos.y)}`);
  await pageA.press("#chat-input", "Enter");

  // A asks; B sees the request and accepts.
  await pageA.evaluate((n) => window.__mmo!.tradeRequest(n), bName);
  await expect.poll(() => pageB.evaluate(() => window.__mmo!.trade().requestFrom ?? null)).toBe(aName);
  await pageB.evaluate(() => window.__mmo!.tradeRespond(true));
  await expect.poll(() => pageA.evaluate(() => window.__mmo!.trade().active)).toBe(true);
  await expect.poll(() => pageB.evaluate(() => window.__mmo!.trade().active)).toBe(true);

  // A offers the sword; both confirm; the swap fires.
  await pageA.evaluate(() => window.__mmo!.tradeOffer([{ itemId: "bronze_sword", qty: 1 }], 0));
  await expect
    .poll(() => pageB.evaluate(() => window.__mmo!.trade().them?.items.length ?? 0))
    .toBeGreaterThan(0);
  await pageA.evaluate(() => window.__mmo!.tradeConfirm());
  await pageB.evaluate(() => window.__mmo!.tradeConfirm());

  // B received the sword; A no longer has it; the trade closed.
  await expect.poll(() => count(pageB, "bronze_sword")).toBe(1);
  await expect.poll(() => count(pageA, "bronze_sword")).toBe(0);
  await expect.poll(() => pageA.evaluate(() => window.__mmo!.trade().active)).toBe(false);

  await ctxA.close();
  await ctxB.close();
});
