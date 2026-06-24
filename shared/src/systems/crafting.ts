import type { ItemDef } from "../data/items";
import type { RecipeDef } from "../data/recipes";
import { addItem, countItem, removeItem, type Inventory } from "./inventory";

/**
 * Pure crafting: consume a recipe's inputs and produce its output, all within
 * the bag. No I/O and no dependency on the global item table (the caller passes
 * a lookup for the output's stack size), so it's fully unit-tested and reused
 * by the server. Returns a NEW inventory; the input is never mutated. The
 * server applies skill XP and ledger entries around a successful craft.
 */
export type ItemLookup = (id: string) => ItemDef | undefined;

export interface CraftResult {
  inventory: Inventory;
  /** False if inputs were missing or the output wouldn't fit (no change). */
  ok: boolean;
}

/** Does the bag hold every input this recipe needs? */
export function canCraft(inv: Inventory, recipe: RecipeDef): boolean {
  return recipe.inputs.every((inp) => countItem(inv, inp.itemId) >= inp.qty);
}

/**
 * Craft one of `recipe`: remove its inputs and add its output. Rejected
 * (ok:false, original inventory) if any input is missing or the output has no
 * room — never partially consumes.
 */
export function craft(inv: Inventory, recipe: RecipeDef, lookup: ItemLookup): CraftResult {
  if (!canCraft(inv, recipe)) return { inventory: inv, ok: false };

  let out: Inventory = inv;
  for (const inp of recipe.inputs) out = removeItem(out, inp.itemId, inp.qty).inventory;

  const maxStack = lookup(recipe.output.itemId)?.maxStack ?? 1;
  const added = addItem(out, recipe.output.itemId, recipe.output.qty, maxStack);
  if (added.added < recipe.output.qty) return { inventory: inv, ok: false }; // no room — abort

  return { inventory: added.inventory, ok: true };
}
