import { test, expect } from "@playwright/test";
import { enterWorld } from "./helpers";

test("a whisper reaches the named recipient and echoes to the sender", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.goto("/");
  await enterWorld(pageA, "Sender");
  await pageB.goto("/");
  await enterWorld(pageB, "Listener");

  // Whisper to the recipient's actual name (guests may get a numeric suffix).
  const bName = await pageB.evaluate(() => window.__mmo!.me()!.name);
  const message = `psst-${Date.now()}`;
  await pageA.evaluate((a) => window.__mmo!.whisper(a.to, a.text), { to: bName, text: message });

  // Recipient receives it; sender sees their own echo.
  await expect(pageB.locator("#chat-log")).toContainText(message, { timeout: 10_000 });
  await expect(pageA.locator("#chat-log")).toContainText(message);

  await ctxA.close();
  await ctxB.close();
});
