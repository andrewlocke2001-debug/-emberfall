import { REPAIR_COST_RATE } from "../types";
import type { ItemDef } from "../data/items";
import type { Equipment } from "./equipment";

/**
 * Gear durability (pure). Equippable items with a `maxDurability` wear down as
 * they're used (a weapon per swing, armor per hit taken). At 0 they're "broken"
 * and grant no combat bonus until repaired at a vendor for coins — the repair
 * fee is the gold sink. Non-gear (or gear without maxDurability) never wears.
 *
 * Durability is tracked per equipped slot by the server/solo engine; these are
 * the rules, unit-tested and shared so the client can preview them too.
 */

/** Does this item track durability at all? */
export function hasDurability(def: ItemDef): boolean {
  return typeof def.maxDurability === "number" && def.maxDurability > 0;
}

/** Reduce durability by `amount`, clamped at 0 (never negative). */
export function wear(current: number, amount = 1): number {
  return Math.max(0, current - amount);
}

/** Broken = worn to 0. A broken item stays equipped but gives no bonus. */
export function isBroken(current: number): boolean {
  return current <= 0;
}

/**
 * Coins to fully repair from `current` to max: proportional to the missing
 * fraction of durability and the item's value. Always at least 1 coin when
 * anything is missing; 0 when already full.
 */
export function repairCost(def: ItemDef, current: number): number {
  const max = def.maxDurability ?? 0;
  if (max <= 0 || current >= max) return 0;
  const missing = (max - current) / max;
  return Math.max(1, Math.round(def.value * REPAIR_COST_RATE * missing));
}

/** Durability per owned gear item, keyed by item id. Missing = full/undamaged. */
export type Durability = Record<string, number>;

/** Remaining durability of an item id (defaults to its max when untracked). */
export function currentDurability(def: ItemDef, durability: Durability): number {
  return durability[def.id] ?? def.maxDurability ?? 0;
}

/**
 * The equipment that actually grants bonuses: broken pieces (durability 0) are
 * dropped so they contribute nothing until repaired. Non-durability gear always
 * counts. Used by the server + solo engine when computing combat stats/maxHp.
 */
export function effectiveEquipment(
  equipment: Equipment,
  durability: Durability,
  lookup: (id: string) => ItemDef | undefined,
): Equipment {
  const out: Equipment = {};
  for (const [slot, itemId] of Object.entries(equipment) as [keyof Equipment, string][]) {
    const def = lookup(itemId);
    if (def && hasDurability(def) && currentDurability(def, durability) <= 0) continue;
    out[slot] = itemId;
  }
  return out;
}
