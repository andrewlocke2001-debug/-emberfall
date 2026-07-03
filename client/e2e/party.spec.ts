import { test, expect } from "@playwright/test";
import { enterWorld } from "./helpers";
import type { Page } from "@playwright/test";

const memberCount = (page: Page): Promise<number> =>
  page.evaluate(() => window.__mmo!.party().members.length);
const invitedBy = (page: Page): Promise<string | null> =>
  page.evaluate(() => window.__mmo!.party().invitedBy ?? null);

test("invite, accept, shared roster, then leave disbands", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.goto("/");
  await enterWorld(pageA, "Leader");
  await pageB.goto("/");
  await enterWorld(pageB, "Member");

  const aName = await pageA.evaluate(() => window.__mmo!.me()!.name);
  const bName = await pageB.evaluate(() => window.__mmo!.me()!.name);

  // A invites B → B sees the pending invite.
  await pageA.evaluate((n) => window.__mmo!.partyInvite(n), bName);
  await expect.poll(() => invitedBy(pageB)).toBe(aName);

  // B accepts → both see a 2-member roster with A as leader.
  await pageB.evaluate(() => window.__mmo!.partyAccept());
  await expect.poll(() => memberCount(pageA)).toBe(2);
  await expect.poll(() => memberCount(pageB)).toBe(2);
  const leader = await pageA.evaluate(
    () => window.__mmo!.party().members.find((m) => m.leader)?.name,
  );
  expect(leader).toBe(aName);

  // B leaves → down to one member, the party disbands for both.
  await pageB.evaluate(() => window.__mmo!.partyLeave());
  await expect.poll(() => memberCount(pageB)).toBe(0);
  await expect.poll(() => memberCount(pageA)).toBe(0);

  await ctxA.close();
  await ctxB.close();
});
