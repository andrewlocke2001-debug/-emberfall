import { BANK_SLOTS, INVENTORY_SLOTS, type ItemStack } from "../types";
import { addItem, countItem, removeItem, type Inventory } from "./inventory";

/**
 * Bank ↔ bag transfers. The bank is the player's larger town storage; moving
 * items between bag and bank never creates or destroys anything (both are the
 * player's possession), so these moves are NOT ledgered. Pure and tested —
 * the caller passes `maxStack` from the item def.
 */
export type Bank = ItemStack[];

export interface TransferResult {
  inventory: Inventory;
  bank: Bank;
  /** How many units actually moved (limited by what's held and target space). */
  moved: number;
}

/** Move up to `qty` of an item from the bag into the bank. */
export function deposit(
  inventory: Inventory,
  bank: Bank,
  itemId: string,
  qty: number,
  maxStack: number,
): TransferResult {
  const want = Math.min(Math.max(0, qty), countItem(inventory, itemId));
  if (want <= 0) return { inventory, bank, moved: 0 };
  const added = addItem(bank, itemId, want, maxStack, BANK_SLOTS);
  if (added.added <= 0) return { inventory, bank, moved: 0 }; // bank full
  const removed = removeItem(inventory, itemId, added.added);
  return { inventory: removed.inventory, bank: added.inventory, moved: added.added };
}

/** Move up to `qty` of an item from the bank into the bag. */
export function withdraw(
  inventory: Inventory,
  bank: Bank,
  itemId: string,
  qty: number,
  maxStack: number,
): TransferResult {
  const want = Math.min(Math.max(0, qty), countItem(bank, itemId));
  if (want <= 0) return { inventory, bank, moved: 0 };
  const added = addItem(inventory, itemId, want, maxStack, INVENTORY_SLOTS);
  if (added.added <= 0) return { inventory, bank, moved: 0 }; // bag full
  const removed = removeItem(bank, itemId, added.added);
  return { inventory: added.inventory, bank: removed.inventory, moved: added.added };
}
