import { test, expect } from "@playwright/test";
import { enterWorldAsGm } from "./helpers";

const SERVER = "http://localhost:2567";

// The economy dashboard aggregates the ledger: coin faucets/sinks by reason and
// per-item supply (created − destroyed). The dev DB has months of ledger rows,
// so we assert real structure + coherent totals rather than exact numbers.
test("economy dashboard reports coin faucets/sinks and item supply", async ({ page }) => {
  await page.goto("/");
  await enterWorldAsGm(page); // ensures the server is warm + at least one account

  const api = await page.request.get(`${SERVER}/api/economy`);
  expect(api.ok()).toBe(true);
  const r = (await api.json()) as {
    coins: { faucets: { reason: string; total: number }[]; sinks: { reason: string; total: number }[]; created: number; destroyed: number; net: number };
    items: { itemId: string; created: number; destroyed: number; net: number }[];
  };
  expect(r.coins.created).toBeGreaterThan(0); // GM /give + loot etc. over the dev DB
  expect(r.coins.net).toBe(r.coins.created - r.coins.destroyed);
  expect(r.coins.faucets.length).toBeGreaterThan(0);
  for (const f of r.coins.faucets) expect(f.total).toBeGreaterThan(0);
  for (const s of r.coins.sinks) expect(s.total).toBeGreaterThan(0);
  // The exchange tax sink exists after the exchange.spec run history.
  expect(r.items.length).toBeGreaterThan(0);
  for (const i of r.items) expect(i.net).toBe(i.created - i.destroyed);

  const html = await page.request.get(`${SERVER}/economy`);
  expect(html.ok()).toBe(true);
  expect(await html.text()).toContain("Emberfall Economy");
});
