import { prisma } from "./persistence/db";

/**
 * Faucet/sink economy report (P8.4), aggregated from the LedgerEntry audit
 * table. Coins created (faucets: loot, quests, vendor sales…) vs destroyed
 * (sinks: purchases, repairs, exchange tax…) grouped by reason, plus per-item
 * supply — created − destroyed = items in the world (the kit's dupe canary).
 * Served like hiscores: /economy (HTML) + /api/economy (JSON). Read-only.
 */
export interface EconomyReport {
  coins: {
    faucets: { reason: string; total: number }[];
    sinks: { reason: string; total: number }[];
    created: number;
    destroyed: number;
    net: number;
  };
  items: { itemId: string; created: number; destroyed: number; net: number }[];
}

export async function getEconomyReport(): Promise<EconomyReport> {
  // A reason can have both + and − rows (e.g. "buy" spends coins and grants
  // items), so aggregate each direction separately.
  const posRows = await prisma.ledgerEntry.groupBy({
    by: ["reason"],
    where: { itemId: "coins", delta: { gt: 0 } },
    _sum: { delta: true },
  });
  const negRows = await prisma.ledgerEntry.groupBy({
    by: ["reason"],
    where: { itemId: "coins", delta: { lt: 0 } },
    _sum: { delta: true },
  });

  const faucets = posRows
    .map((r) => ({ reason: r.reason, total: r._sum.delta ?? 0 }))
    .sort((a, b) => b.total - a.total);
  const sinks = negRows
    .map((r) => ({ reason: r.reason, total: -(r._sum.delta ?? 0) }))
    .sort((a, b) => b.total - a.total);
  const created = faucets.reduce((n, f) => n + f.total, 0);
  const destroyed = sinks.reduce((n, s) => n + s.total, 0);

  const itemRows = await prisma.ledgerEntry.groupBy({
    by: ["itemId"],
    where: { itemId: { not: "coins" } },
    _sum: { delta: true },
  });
  const itemPos = await prisma.ledgerEntry.groupBy({
    by: ["itemId"],
    where: { itemId: { not: "coins" }, delta: { gt: 0 } },
    _sum: { delta: true },
  });
  const posMap = new Map(itemPos.map((r) => [r.itemId, r._sum.delta ?? 0]));
  const items = itemRows
    .map((r) => {
      const net = r._sum.delta ?? 0;
      const createdQty = posMap.get(r.itemId) ?? 0;
      return { itemId: r.itemId, created: createdQty, destroyed: createdQty - net, net };
    })
    .sort((a, b) => b.net - a.net)
    .slice(0, 50);

  return { coins: { faucets, sinks, created, destroyed, net: created - destroyed }, items };
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderEconomyHtml(r: EconomyReport): string {
  const row = (a: string, b: number): string => `<tr><td>${esc(a)}</td><td>${b}</td></tr>`;
  const itemRow = (i: EconomyReport["items"][number]): string =>
    `<tr><td>${esc(i.itemId)}</td><td>${i.created}</td><td>${i.destroyed}</td><td>${i.net}</td></tr>`;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Emberfall Economy</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:system-ui,sans-serif;background:#0d1018;color:#e6e6e6;max-width:720px;margin:24px auto;padding:0 12px}
table{width:100%;border-collapse:collapse;margin:8px 0 20px}td,th{padding:5px 8px;border-bottom:1px solid #2a3142;text-align:left}
th{color:#8893a7}h1{color:#ffe066;font-size:22px}h2{color:#9fb4d8;font-size:15px}.net{color:#ffd34d}</style></head>
<body><h1>🪙 Emberfall Economy</h1>
<p class="net">Coins: ${r.coins.created} created − ${r.coins.destroyed} destroyed = <strong>${r.coins.net} in circulation</strong></p>
<h2>Faucets (coins in)</h2><table><thead><tr><th>Reason</th><th>Total</th></tr></thead><tbody>
${r.coins.faucets.map((f) => row(f.reason, f.total)).join("")}</tbody></table>
<h2>Sinks (coins out)</h2><table><thead><tr><th>Reason</th><th>Total</th></tr></thead><tbody>
${r.coins.sinks.map((s) => row(s.reason, s.total)).join("")}</tbody></table>
<h2>Item supply (created − destroyed = in world)</h2>
<table><thead><tr><th>Item</th><th>Created</th><th>Destroyed</th><th>In world</th></tr></thead><tbody>
${r.items.map(itemRow).join("")}</tbody></table></body></html>`;
}
