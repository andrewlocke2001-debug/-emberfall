import type { ItemStack } from "../types";

/**
 * Player-to-player trade rules (pure). A trade has two participants, each with
 * an offer (items + coins) and a confirmation flag. The security-critical
 * invariant lives here: ANY change to either offer clears BOTH confirmations,
 * so you can never confirm what you saw and receive something else — the swap
 * only fires when both sides have confirmed the exact current offers.
 *
 * The server owns the live session + performs the atomic inventory swap (it
 * needs bag contents/space); these are the state-machine rules, unit-tested and
 * shared so the client can mirror the confirm-reset behaviour in its UI.
 */
export interface TradeOffer {
  items: ItemStack[];
  coins: number;
  confirmed: boolean;
}

export function emptyOffer(): TradeOffer {
  return { items: [], coins: 0, confirmed: false };
}

/**
 * Replace a participant's offer. Returns fresh copies of BOTH offers with
 * `confirmed` cleared — an offer change invalidates any prior agreement.
 */
export function setOffer(
  mine: TradeOffer,
  theirs: TradeOffer,
  items: ItemStack[],
  coins: number,
): { mine: TradeOffer; theirs: TradeOffer } {
  return {
    mine: { items: items.map((s) => ({ ...s })), coins: Math.max(0, Math.floor(coins)), confirmed: false },
    theirs: { ...theirs, items: theirs.items.map((s) => ({ ...s })), confirmed: false },
  };
}

/** Mark my side confirmed. (The server only lets you confirm your own side.) */
export function confirmOffer(mine: TradeOffer): TradeOffer {
  return { ...mine, confirmed: true };
}

/** The swap fires only when both sides have confirmed the current offers. */
export function bothConfirmed(a: TradeOffer, b: TradeOffer): boolean {
  return a.confirmed && b.confirmed;
}
