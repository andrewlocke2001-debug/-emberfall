import type { ItemStack } from "../types";
import type { Rng } from "./combatmath";

/**
 * Loot tables + rolling. Pure and deterministic — RNG is injected so kills are
 * testable and could be seeded per-room. A mob's drop table lives in its data
 * (see @mmo/shared/data/mobs); the server rolls it on death, once per
 * contributor (GW2-style personal loot — no kill-stealing).
 */

/** One possible drop: roll `chance`, then a quantity uniformly in [min, max]. */
export interface DropEntry {
  itemId: string;
  /** Inclusive quantity range (min === max for a fixed amount). */
  min: number;
  max: number;
  /** Probability in [0, 1] that this entry drops at all. */
  chance: number;
}

/**
 * Roll a drop table into concrete item stacks. Each entry is an independent
 * roll: `chance` to drop, then a uniform quantity in [min, max]. Consumes up to
 * two RNG draws per entry (drop, then quantity).
 */
export function rollDrops(drops: DropEntry[], rng: Rng = Math.random): ItemStack[] {
  const out: ItemStack[] = [];
  for (const d of drops) {
    if (rng() >= d.chance) continue;
    const span = Math.max(0, d.max - d.min);
    const qty = d.min + Math.floor(rng() * (span + 1));
    if (qty > 0) out.push({ itemId: d.itemId, qty });
  }
  return out;
}
