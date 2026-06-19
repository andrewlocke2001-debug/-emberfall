import { INVENTORY_SLOTS, type ItemStack } from "../types";

/**
 * Pure inventory operations — stacking + the 28-slot cap. No I/O, no item-table
 * dependency (the caller passes `maxStack` from the item def), so this is fully
 * unit-testable and reused by the server (authority) and any client preview.
 * Every function returns a NEW inventory; inputs are never mutated.
 */
export type Inventory = ItemStack[];

export interface AddResult {
  inventory: Inventory;
  /** How many units actually fit (may be < requested if the bag filled up). */
  added: number;
}

export interface RemoveResult {
  inventory: Inventory;
  /** How many units were actually removed (may be < requested). */
  removed: number;
}

/** Deep-copy an inventory (stacks are plain {itemId, qty}). */
export function cloneInventory(inv: Inventory): Inventory {
  return inv.map((s) => ({ ...s }));
}

/** Total quantity of an item across all stacks. */
export function countItem(inv: Inventory, itemId: string): number {
  return inv.reduce((sum, s) => (s.itemId === itemId ? sum + s.qty : sum), 0);
}

/**
 * Add `qty` of an item: top up existing stacks first (up to `maxStack`), then
 * open new slots until the 28-slot cap. Returns the new inventory and how many
 * units actually fit (the remainder is "overflow" the caller must handle —
 * e.g. drop on the ground or refuse).
 */
export function addItem(inv: Inventory, itemId: string, qty: number, maxStack: number): AddResult {
  const out = cloneInventory(inv);
  if (qty <= 0) return { inventory: out, added: 0 };
  let remaining = qty;

  for (const stack of out) {
    if (remaining <= 0) break;
    if (stack.itemId === itemId && stack.qty < maxStack) {
      const take = Math.min(maxStack - stack.qty, remaining);
      stack.qty += take;
      remaining -= take;
    }
  }
  while (remaining > 0 && out.length < INVENTORY_SLOTS) {
    const take = Math.min(maxStack, remaining);
    out.push({ itemId, qty: take });
    remaining -= take;
  }
  return { inventory: out, added: qty - remaining };
}

/** True if `qty` of an item would fully fit (no overflow). */
export function canAdd(inv: Inventory, itemId: string, qty: number, maxStack: number): boolean {
  return addItem(inv, itemId, qty, maxStack).added === qty;
}

/**
 * Remove up to `qty` of an item, draining stacks in order and dropping any that
 * hit zero. Returns the new inventory and how many were actually removed.
 */
export function removeItem(inv: Inventory, itemId: string, qty: number): RemoveResult {
  const out = cloneInventory(inv);
  if (qty <= 0) return { inventory: out, removed: 0 };
  let remaining = qty;

  for (const stack of out) {
    if (remaining <= 0) break;
    if (stack.itemId === itemId) {
      const take = Math.min(stack.qty, remaining);
      stack.qty -= take;
      remaining -= take;
    }
  }
  return { inventory: out.filter((s) => s.qty > 0), removed: qty - remaining };
}
