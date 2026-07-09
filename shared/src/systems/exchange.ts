import { EXCHANGE_TAX_RATE } from "../types";

/**
 * The Exchange — an asynchronous order-book market (RuneScape's Grand Exchange).
 * Players post buy/sell limit orders; the engine matches crossing orders with
 * **price-time priority** and executes at the resting (already-on-book) order's
 * price, so whoever was there first sets the price and the incoming taker gets
 * any price improvement.
 *
 * This module is the pure matching core (unit-tested). The server owns the
 * durable book (Prisma), escrow, coin tax, and settlement; it feeds resting
 * orders in and applies the fills out.
 */
export type OrderSide = "buy" | "sell";

export interface Order {
  id: string;
  side: OrderSide;
  itemId: string;
  /** Unfilled quantity remaining on this order. */
  remaining: number;
  /** Per-unit limit price in coins. */
  price: number;
  /** For time priority (older = higher priority at equal price). */
  createdAt: number;
}

/** One executed match between a buy and a sell order. */
export interface Fill {
  buyOrderId: string;
  sellOrderId: string;
  itemId: string;
  qty: number;
  /** Execution price per unit (the resting order's price). */
  price: number;
}

export interface MatchResult {
  fills: Fill[];
  /** New `remaining` for each resting order that was (partly) filled. */
  restingUpdates: { id: string; remaining: number }[];
  /** The incoming order's leftover quantity (rests on the book if > 0). */
  incomingRemaining: number;
}

/** Does the incoming order cross (trade against) this resting order? */
function crosses(incoming: Order, resting: Order): boolean {
  return incoming.side === "buy" ? incoming.price >= resting.price : incoming.price <= resting.price;
}

/**
 * Match `incoming` against the resting `book`. Pure: inputs are never mutated;
 * matched resting orders are reported via `restingUpdates`. Executes at each
 * resting order's price, best price first then oldest.
 */
export function matchOrder(incoming: Order, book: readonly Order[]): MatchResult {
  const candidates = book
    .filter(
      (o) =>
        o.side !== incoming.side &&
        o.itemId === incoming.itemId &&
        o.remaining > 0 &&
        crosses(incoming, o),
    )
    .sort((a, b) =>
      // Buyers take the cheapest sells; sellers hit the highest buys; ties by age.
      a.price !== b.price
        ? incoming.side === "buy"
          ? a.price - b.price
          : b.price - a.price
        : a.createdAt - b.createdAt,
    );

  const fills: Fill[] = [];
  const restingUpdates: { id: string; remaining: number }[] = [];
  let remaining = incoming.remaining;

  for (const resting of candidates) {
    if (remaining <= 0) break;
    const qty = Math.min(remaining, resting.remaining);
    fills.push({
      buyOrderId: incoming.side === "buy" ? incoming.id : resting.id,
      sellOrderId: incoming.side === "sell" ? incoming.id : resting.id,
      itemId: incoming.itemId,
      qty,
      price: resting.price,
    });
    remaining -= qty;
    restingUpdates.push({ id: resting.id, remaining: resting.remaining - qty });
  }

  return { fills, restingUpdates, incomingRemaining: remaining };
}

/** Coin tax taken from a sale's gross proceeds (a sink). */
export function exchangeTax(gross: number): number {
  return Math.floor(Math.max(0, gross) * EXCHANGE_TAX_RATE);
}

/** What the seller actually receives after tax. */
export function sellerProceeds(gross: number): number {
  return Math.max(0, gross) - exchangeTax(gross);
}
