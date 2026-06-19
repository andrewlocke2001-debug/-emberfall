import { prisma } from "./db";

/**
 * Economy audit ledger (kit rule #6). Every item created or destroyed appends
 * one row so the world's item supply always reconciles to created − destroyed —
 * the first line of defense against dupe bugs that kill MMO economies.
 *
 * Writes are fault-tolerant: a failed ledger insert is logged loudly but never
 * crashes the player's action. (A persistent failure here is a serious alert
 * worth wiring to monitoring in a later ops pass.)
 */
export interface LedgerRecord {
  /** Owning account id, or a sentinel ("world") for non-player sources. */
  account: string;
  itemId: string;
  /** +N when created/granted, −N when destroyed/consumed. */
  delta: number;
  /** Why: "gm_give", "loot", "bank_deposit", "consume", … */
  reason: string;
}

export async function recordLedger(r: LedgerRecord): Promise<void> {
  if (r.delta === 0) return;
  try {
    await prisma.ledgerEntry.create({ data: r });
  } catch (err) {
    console.error("[ledger] FAILED to record entry (item integrity at risk):", r, err);
  }
}
