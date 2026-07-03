import { test, expect } from "@playwright/test";
import { enterWorld } from "./helpers";
import type { Page } from "@playwright/test";

const guildName = (page: Page): Promise<string | null> =>
  page.evaluate(() => window.__mmo!.guild().name ?? null);
const memberCount = (page: Page): Promise<number> =>
  page.evaluate(() => window.__mmo!.guild().members.length);

// Guild names/tags are unique in the DB — timestamp them so re-runs are safe.
// Both players leave at the end, which disbands (deletes) the guild.
test("found a guild, invite + accept, guild chat, then disband", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.goto("/");
  await enterWorld(pageA, "Founder");
  await pageB.goto("/");
  await enterWorld(pageB, "Recruit");

  const bName = await pageB.evaluate(() => window.__mmo!.me()!.name);
  const stamp = Date.now().toString(36).slice(-6);
  const gName = `Watch ${stamp}`;
  const gTag = stamp.slice(-4).toUpperCase();

  // Found the guild — the founder becomes leader.
  await pageA.evaluate((g) => window.__mmo!.guildCreate(g.name, g.tag), { name: gName, tag: gTag });
  await expect.poll(() => guildName(pageA)).toBe(gName);
  expect(await pageA.evaluate(() => window.__mmo!.guild().myRank)).toBe("leader");

  // Invite + accept — both see the 2-member roster.
  await pageA.evaluate((n) => window.__mmo!.guildInvite(n), bName);
  await expect
    .poll(() => pageB.evaluate(() => window.__mmo!.guild().invitedTo?.guildName ?? null))
    .toBe(gName);
  await pageB.evaluate(() => window.__mmo!.guildAccept());
  await expect.poll(() => memberCount(pageA)).toBe(2);
  await expect.poll(() => guildName(pageB)).toBe(gName);

  // Guild chat crosses only to members.
  const message = `rally-${stamp}`;
  await pageA.evaluate(() => {
    const btn = document.getElementById("chat-channel") as HTMLButtonElement;
    btn.click(); // zone → global
    btn.click(); // global → guild
  });
  await pageA.fill("#chat-input", message);
  await pageA.press("#chat-input", "Enter");
  await expect(pageB.locator("#chat-log")).toContainText(message, { timeout: 10_000 });

  // Both leave — the last one out disbands the guild.
  await pageB.evaluate(() => window.__mmo!.guildLeave());
  await expect.poll(() => guildName(pageB)).toBeNull();
  await expect.poll(() => memberCount(pageA)).toBe(1);
  await pageA.evaluate(() => window.__mmo!.guildLeave());
  await expect.poll(() => guildName(pageA)).toBeNull();

  await ctxA.close();
  await ctxB.close();
});
