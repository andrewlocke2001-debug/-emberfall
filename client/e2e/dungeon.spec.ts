import { test, expect } from "@playwright/test";
import { enterWorldAsGm } from "./helpers";
import type { Page } from "@playwright/test";

const zone = (page: Page): Promise<string | null> =>
  page.evaluate(() => window.__mmo!.zone());
const roomId = (page: Page): Promise<string> =>
  page.evaluate(() => window.__mmo!.roomId());

async function tp(page: Page, x: number, y: number): Promise<void> {
  await page.fill("#chat-input", `/tp ${x} ${y}`);
  await page.press("#chat-input", "Enter");
}

// The Cinder Depths gate sits in the Tanglewood ruins at tile (51,27); its
// south gate back out is at tile (19,38). Standing on a gate auto-transfers.
test("enter the instanced Cinder Depths and return to Tanglewood", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("mmo:zone", "tanglewood"));
  await enterWorldAsGm(page);

  // Land somewhere safe in Tanglewood (never on a gate) before we begin.
  await tp(page, 300, 928);
  await expect.poll(() => zone(page)).toBe("tanglewood");
  const overworldRoom = await roomId(page);

  // Step onto the dungeon gate → a fresh instanced room (different roomId).
  await tp(page, 1648, 880);
  await expect.poll(() => zone(page), { timeout: 20_000 }).toBe("cinder_depths");
  const dungeonRoom = await roomId(page);
  expect(dungeonRoom).not.toBe(overworldRoom);

  // Walk out the south gate → back to Tanglewood (an overworld room, not the
  // instance we just left).
  await tp(page, 624, 1232);
  await expect.poll(() => zone(page), { timeout: 20_000 }).toBe("tanglewood");
  expect(await roomId(page)).not.toBe(dungeonRoom);
});
