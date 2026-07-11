import { PVP_DEATH_DROPS, PVP_LEVEL_BAND, type ItemStack } from "../types";
import type { ItemDef } from "../data/items";
import { removeItem, type Inventory } from "./inventory";

/**
 * Open-world PvP rules for risk zones (the Ashreach) — pure and unit-tested.
 * Anti-grief: attacks only land within a melee-level band. Death costs the
 * PVP_DEATH_DROPS most valuable single items + every carried coin.
 */

/** May `attacker` hit `target`? Only within the level band (anti-grief). */
export function canAttack(attackerLevel: number, targetLevel: number): boolean {
  return Math.abs(attackerLevel - targetLevel) <= PVP_LEVEL_BAND;
}

/**
 * What a death in a PvP zone drops: the N most valuable single units (by item
 * value; coins excluded from that count) plus ALL carried coins. Returns the
 * dropped stacks and the surviving inventory.
 */
export function deathDrops(
  inventory: Inventory,
  lookup: (id: string) => ItemDef | undefined,
): { drops: ItemStack[]; remaining: Inventory } {
  // Expand to (itemId, unit value) candidates, best value first.
  const units: { itemId: string; value: number }[] = [];
  for (const stack of inventory) {
    if (stack.itemId === "coins") continue;
    const value = lookup(stack.itemId)?.value ?? 0;
    for (let i = 0; i < Math.min(stack.qty, PVP_DEATH_DROPS); i++) units.push({ itemId: stack.itemId, value });
  }
  units.sort((a, b) => b.value - a.value);

  let remaining = inventory;
  const dropped = new Map<string, number>();
  for (const u of units.slice(0, PVP_DEATH_DROPS)) {
    const r = removeItem(remaining, u.itemId, 1);
    if (r.removed > 0) {
      remaining = r.inventory;
      dropped.set(u.itemId, (dropped.get(u.itemId) ?? 0) + 1);
    }
  }
  // All coins always drop.
  const coins = inventory.reduce((n, s) => (s.itemId === "coins" ? n + s.qty : n), 0);
  if (coins > 0) {
    remaining = removeItem(remaining, "coins", coins).inventory;
    dropped.set("coins", coins);
  }
  return {
    drops: [...dropped.entries()].map(([itemId, qty]) => ({ itemId, qty })),
    remaining,
  };
}
