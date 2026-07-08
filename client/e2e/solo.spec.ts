import { test, expect } from "@playwright/test";
import { enterWorld } from "./helpers";
import type { Page } from "@playwright/test";

const count = (page: Page, id: string): Promise<number> =>
  page.evaluate(
    (i) => window.__mmo!.inventory().reduce((n, s) => (s.itemId === i ? n + s.qty : n), 0),
    id,
  );

// The single-player build runs the whole game in-browser with no server. `?solo`
// flips the client into local mode at runtime, so this exercises the real
// static-build path against the same UI + shared systems.
test("single-player runs the core loop with no server", async ({ page }) => {
  // Fresh character (solo persists to localStorage) — clear once, before entering.
  await page.goto("/?solo");
  await page.evaluate(() => localStorage.removeItem("mmo:solo:v1"));
  await enterWorld(page, "SoloTester");

  // We're in the world, no server involved.
  await expect.poll(() => page.evaluate(() => window.__mmo!.zone())).toBe("meadowbrook");
  expect(await page.evaluate(() => window.__mmo!.me()!.hp)).toBeGreaterThan(0);

  // Sandbox /give lands items in the bag (dispatch → inventory push).
  await page.fill("#chat-input", "/give leather_body 1");
  await page.press("#chat-input", "Enter");
  await expect.poll(() => count(page, "leather_body")).toBe(1);

  // Equipping applies stats (maxHp rises), all client-side.
  const baseMax = await page.evaluate(() => window.__mmo!.me()!.maxHp);
  await page.evaluate(() => window.__mmo!.equip("leather_body"));
  await expect.poll(() => page.evaluate(() => window.__mmo!.me()!.maxHp)).toBeGreaterThan(baseMax);

  // Gathering works: teleport to the town copper rock and mine an ore.
  await page.fill("#chat-input", "/tp 304 1072");
  await page.press("#chat-input", "Enter");
  await page.evaluate(() => window.__mmo!.gather("copper-1"));
  await expect.poll(() => count(page, "copper_ore"), { timeout: 10_000 }).toBeGreaterThan(0);

  // Persistence: reload and the character (with its ore) is still there.
  await page.reload();
  await enterWorld(page, "SoloTester");
  await expect.poll(() => count(page, "copper_ore")).toBeGreaterThan(0);
});
