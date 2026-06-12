/**
 * Live smoke test: two headless browsers join the DEPLOYED game and verify
 * they share one world and combat syncs. Usage:
 *   node tools/live-smoke.mjs https://emberfall-server.fly.dev
 */
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "https://emberfall-server.fly.dev";
const url = `${base}/?canvas=1`;

const browser = await chromium.launch({ args: ["--disable-gpu", "--disable-software-rasterizer"] });

async function join(name) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error(`[${name}] pageerror:`, e.message));
  page.on("console", (m) => console.log(`[${name}] console.${m.type()}: ${m.text()}`));
  page.on("requestfailed", (r) => console.error(`[${name}] request failed: ${r.url()} — ${r.failure()?.errorText}`));
  page.on("response", (r) => {
    const path = new URL(r.url()).pathname;
    console.log(`[${name}] response: HTTP ${r.status()} ${path}`);
  });
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (path.includes("assets") || path.includes("matchmake")) console.log(`[${name}] request: ${path}`);
  });
  page.on("websocket", (ws) => {
    console.log(`[${name}] websocket opened: ${ws.url()}`);
    ws.on("close", () => console.log(`[${name}] websocket closed`));
    ws.on("socketerror", (e) => console.error(`[${name}] websocket error: ${e}`));
  });
  await page.goto(url, { waitUntil: "commit", timeout: 60_000 });
  await page.waitForSelector("#name", { timeout: 60_000 });
  await page.fill("#name", name, { timeout: 15_000 });
  await page.click("#enter");
  try {
    await page.waitForFunction(() => window.__mmo?.ready === true, undefined, { timeout: 25_000 });
  } catch (err) {
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => "(unreadable)");
    console.error(`[${name}] join stalled. Page says: ${JSON.stringify(bodyText.slice(0, 200))}`);
    throw err;
  }
  await page.waitForFunction(() => window.__mmo.me() !== null, undefined, { timeout: 25_000 });
  return page;
}

console.log(`[smoke] joining as Frodo @ ${url}`);
const p1 = await join("Frodo");
console.log("[smoke] Frodo is in. joining as Sam...");
const p2 = await join("Sam");
console.log("[smoke] Sam is in.");

await p1.waitForFunction(() => window.__mmo.playerCount() >= 2, undefined, { timeout: 15_000 });
await p2.waitForFunction(() => window.__mmo.playerCount() >= 2, undefined, { timeout: 15_000 });
console.log(`[smoke] both see a shared world: p1=${await p1.evaluate(() => window.__mmo.playerCount())} players, p2=${await p2.evaluate(() => window.__mmo.playerCount())} players`);

// Walk Frodo into Strike range first (spawn is ~220px from the dummy; range is 150).
await p1.evaluate(() => window.__mmo.move(0, -1));
await p1.waitForTimeout(1500);
await p1.evaluate(() => window.__mmo.move(0, 0));

const hpBefore = await p1.evaluate(() => window.__mmo.enemyHp("dummy-1"));
await p1.evaluate(() => window.__mmo.attack("dummy-1"));
await p2.waitForFunction(
  (before) => (window.__mmo.enemyHp("dummy-1") ?? before) < before,
  hpBefore,
  { timeout: 10_000 },
);
const hpAfterP2 = await p2.evaluate(() => window.__mmo.enemyHp("dummy-1"));
console.log(`[smoke] combat syncs across clients: dummy ${hpBefore} -> ${hpAfterP2} (seen by the OTHER player)`);

await browser.close();
console.log("[smoke] LIVE SMOKE PASSED ✔ — the deployed game is multiplayer-ready.");
