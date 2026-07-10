import {
  matchOrder,
  exchangeTax,
  sellerProceeds,
  type Order,
  type OrderSide,
} from "@mmo/shared/systems/exchange";
import { prisma } from "../persistence/db";
import { recordLedger } from "../persistence/ledger";

/**
 * Server-side Exchange: the durable order book + matching pass + settlement.
 * Escrow (items/coins off the bag on post) and collection (proceeds into the
 * bag) are handled by ZoneRoom, which owns the live inventory; this module owns
 * the DB — post/match/settle, list, cancel, and the price feed. The pure
 * price-time matching lives in @mmo/shared/systems/exchange (unit-tested).
 *
 * Only the tax is real coin destruction (the sink) and is ledgered; escrow and
 * collection are transfers (bag <-> order), like the bank, so they aren't.
 */
export interface ExchangeOrderRow {
  id: string;
  accountId: string;
  side: OrderSide;
  itemId: string;
  qty: number;
  remaining: number;
  price: number;
  coinsToCollect: number;
  itemsToCollect: number;
}

function toOrder(r: { id: string; side: string; itemId: string; remaining: number; price: number; createdAt: Date }): Order {
  return {
    id: r.id,
    side: r.side as OrderSide,
    itemId: r.itemId,
    remaining: r.remaining,
    price: r.price,
    createdAt: r.createdAt.getTime(),
  };
}

/**
 * Post a new order (escrow already taken by the caller), match it against the
 * resting book, and settle fills onto the counterparties' collection buckets.
 * Proceeds (net of tax) + bought items accrue to order rows for async pickup.
 */
export async function postExchangeOrder(
  accountId: string,
  side: OrderSide,
  itemId: string,
  qty: number,
  price: number,
): Promise<void> {
  const oppSide: OrderSide = side === "buy" ? "sell" : "buy";
  const restRows = await prisma.exchangeOrder.findMany({
    where: { itemId, side: oppSide, remaining: { gt: 0 } },
  });
  const created = await prisma.exchangeOrder.create({
    data: { accountId, side, itemId, qty, remaining: qty, price },
  });

  // price + owning account per order id (for refund + tax attribution).
  const info = new Map<string, { price: number; accountId: string }>();
  info.set(created.id, { price, accountId });
  for (const r of restRows) info.set(r.id, { price: r.price, accountId: r.accountId });

  const incoming = toOrder(created);
  const book = restRows.map(toOrder);
  const result = matchOrder(incoming, book);

  // Apply remaining updates (resting orders + the incoming one).
  for (const u of result.restingUpdates) {
    await prisma.exchangeOrder.update({ where: { id: u.id }, data: { remaining: u.remaining } });
  }
  await prisma.exchangeOrder.update({
    where: { id: created.id },
    data: { remaining: result.incomingRemaining },
  });

  // Settle each fill.
  for (const fill of result.fills) {
    const q = fill.qty;
    const gross = fill.price * q;
    const tax = exchangeTax(gross);
    const net = sellerProceeds(gross);
    const buyPrice = info.get(fill.buyOrderId)!.price;
    const refund = (buyPrice - fill.price) * q; // buyer overpay when they crossed a cheaper sell

    // Seller collects the net coins; buyer collects the items + any refund.
    await prisma.exchangeOrder.update({
      where: { id: fill.sellOrderId },
      data: { coinsToCollect: { increment: net } },
    });
    await prisma.exchangeOrder.update({
      where: { id: fill.buyOrderId },
      data: { coinsToCollect: { increment: refund }, itemsToCollect: { increment: q } },
    });
    if (tax > 0) {
      void recordLedger({
        account: info.get(fill.sellOrderId)!.accountId,
        itemId: "coins",
        delta: -tax,
        reason: "exchange_tax",
      });
    }
    await prisma.exchangeTrade.create({ data: { itemId, price: fill.price, qty: q } });
  }
}

/** A player's open orders (with pending collection). */
export async function listExchangeOrders(accountId: string): Promise<ExchangeOrderRow[]> {
  const rows = await prisma.exchangeOrder.findMany({
    where: { accountId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    side: r.side as OrderSide,
    itemId: r.itemId,
    qty: r.qty,
    remaining: r.remaining,
    price: r.price,
    coinsToCollect: r.coinsToCollect,
    itemsToCollect: r.itemsToCollect,
  }));
}

export async function getExchangeOrder(id: string): Promise<ExchangeOrderRow | null> {
  const r = await prisma.exchangeOrder.findUnique({ where: { id } });
  if (!r) return null;
  return {
    id: r.id,
    accountId: r.accountId,
    side: r.side as OrderSide,
    itemId: r.itemId,
    qty: r.qty,
    remaining: r.remaining,
    price: r.price,
    coinsToCollect: r.coinsToCollect,
    itemsToCollect: r.itemsToCollect,
  };
}

/** Update an order's collection buckets (after a partial/full pickup). */
export async function setExchangeCollect(id: string, coins: number, items: number): Promise<void> {
  await prisma.exchangeOrder.update({
    where: { id },
    data: { coinsToCollect: coins, itemsToCollect: items },
  });
}

export async function deleteExchangeOrder(id: string): Promise<void> {
  await prisma.exchangeOrder.delete({ where: { id } }).catch(() => {});
}

export async function countOpenOrders(accountId: string): Promise<number> {
  return prisma.exchangeOrder.count({ where: { accountId } });
}

/** Recent trade prices for an item (newest first) — the price history feed. */
export async function recentPrices(itemId: string, take = 10): Promise<{ price: number; qty: number; at: number }[]> {
  const rows = await prisma.exchangeTrade.findMany({
    where: { itemId },
    orderBy: { at: "desc" },
    take,
  });
  return rows.map((r) => ({ price: r.price, qty: r.qty, at: r.at.getTime() }));
}
