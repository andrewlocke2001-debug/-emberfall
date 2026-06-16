import { test, expect } from "@playwright/test";
import { enterWorld } from "./helpers";

test("zone chat is delivered to everyone in the zone", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.goto("/");
  await enterWorld(pageA, "Alice");
  await pageB.goto("/");
  await enterWorld(pageB, "Bob");

  const message = `hello-${Date.now()}`;
  await pageA.fill("#chat-input", message);
  await pageA.press("#chat-input", "Enter");

  // Both the sender and the other player in the zone see it (server broadcast).
  await expect(pageB.locator("#chat-log")).toContainText(message, { timeout: 10_000 });
  await expect(pageA.locator("#chat-log")).toContainText(message);

  await ctxA.close();
  await ctxB.close();
});
