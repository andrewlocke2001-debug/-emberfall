import type { EquipSlot, ItemBonus, ItemDef } from "../data/items";
import { addItem, countItem, removeItem, type Inventory } from "./inventory";

/**
 * Equipment: which item occupies each gear slot, plus the pure equip/unequip
 * moves between the bag and the slots, and the combat-stat bonus the equipped
 * set grants. No I/O and no dependency on the global item table — the caller
 * passes a lookup — so it's fully unit-tested and reused by the server.
 * Every function returns NEW inventory/equipment; inputs are never mutated.
 */
export type Equipment = Partial<Record<EquipSlot, string>>;

/** Resolve an item id to its definition (so this stays table-agnostic). */
export type ItemLookup = (id: string) => ItemDef | undefined;

export interface EquipResult {
  inventory: Inventory;
  equipment: Equipment;
  /** False if the move was rejected (not owned, not equippable, no room). */
  ok: boolean;
}

/** Sum the combat bonuses of every equipped item (missing fields → 0). */
export function equipmentBonus(eq: Equipment, lookup: ItemLookup): Required<ItemBonus> {
  const total = { attack: 0, strength: 0, defence: 0, maxHp: 0 };
  for (const id of Object.values(eq)) {
    const b: ItemBonus | undefined = id ? lookup(id)?.bonus : undefined;
    if (!b) continue;
    total.attack += b.attack ?? 0;
    total.strength += b.strength ?? 0;
    total.defence += b.defence ?? 0;
    total.maxHp += b.maxHp ?? 0;
  }
  return total;
}

/**
 * Equip one unit of `itemId` from the bag into its slot. Anything already in
 * that slot swaps back into the bag. Rejected (ok:false, unchanged) if the item
 * isn't owned, isn't equippable, or the swapped-out item wouldn't fit.
 */
export function equip(
  inventory: Inventory,
  equipment: Equipment,
  itemId: string,
  lookup: ItemLookup,
): EquipResult {
  const def = lookup(itemId);
  if (!def?.equipSlot) return { inventory, equipment, ok: false };
  if (countItem(inventory, itemId) < 1) return { inventory, equipment, ok: false };

  const slot = def.equipSlot;
  let inv = removeItem(inventory, itemId, 1).inventory;
  const eq: Equipment = { ...equipment };

  const previous = eq[slot];
  if (previous) {
    const back = addItem(inv, previous, 1, lookup(previous)?.maxStack ?? 1);
    if (back.added < 1) return { inventory, equipment, ok: false }; // no room to swap
    inv = back.inventory;
  }
  eq[slot] = itemId;
  return { inventory: inv, equipment: eq, ok: true };
}

/** Unequip a slot back into the bag. Rejected if empty or the bag is full. */
export function unequip(
  inventory: Inventory,
  equipment: Equipment,
  slot: EquipSlot,
  lookup: ItemLookup,
): EquipResult {
  const id = equipment[slot];
  if (!id) return { inventory, equipment, ok: false };
  const back = addItem(inventory, id, 1, lookup(id)?.maxStack ?? 1);
  if (back.added < 1) return { inventory, equipment, ok: false };
  const eq: Equipment = { ...equipment };
  delete eq[slot];
  return { inventory: back.inventory, equipment: eq, ok: true };
}
