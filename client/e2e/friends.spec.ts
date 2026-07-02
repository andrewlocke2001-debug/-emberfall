import { test, expect } from "@playwright/test";
import { enterWorld } from "./helpers";
import type { Page } from "@playwright/test";

const friendNamed = (page: Page, name: string): Promise<{ online: boolean; zone?: string } | null> =>
  page.evaluate((n) => {
    const f = window.__mmo!.friends().find((x) => x.name === n);
    return f ? { online: f.online, ...(f.zone !== undefined ? { zone: f.zone } : {}) } : null;
  }, name);

test("add a friend, see them online with a zone, then remove them", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.goto("/");
  await enterWorld(pageA, "Adder");
  await pageB.goto("/");
  await enterWorld(pageB, "Friendo");

  const bName = await pageB.evaluate(() => window.__mmo!.me()!.name);

  // Add by name → server validates the character exists and pushes the list.
  await pageA.evaluate((n) => window.__mmo!.friendAdd(n), bName);
  await expect
    .poll(async () => (await friendNamed(pageA, bName))?.online ?? null)
    .toBe(true);
  expect((await friendNamed(pageA, bName))?.zone).toBe("meadowbrook");

  // Remove → gone from the list.
  await pageA.evaluate((n) => window.__mmo!.friendRemove(n), bName);
  await expect.poll(async () => friendNamed(pageA, bName)).toBeNull();

  await ctxA.close();
  await ctxB.close();
});
