import { GEAR_BUYBACK_RATE, VENDOR_BUYBACK_RATE } from "../types";
import type { ItemDef } from "../data/items";

/**
 * Vendor pricing (pure). Buying from a vendor costs the item's value (a coin
 * sink); selling to one pays a fraction of value (a coin faucet, tuned by
 * VENDOR_BUYBACK_RATE). Both clamp to at least 1 coin.
 */
export function buyCost(def: ItemDef): number {
  return Math.max(1, Math.floor(def.value));
}

export function sellValue(def: ItemDef): number {
  // Equipment sells at a worse rate: mass-forging gear for vendor coin was
  // the economy's biggest faucet (play-test: mount money in minutes).
  const rate = def.equipSlot ? GEAR_BUYBACK_RATE : VENDOR_BUYBACK_RATE;
  return Math.max(1, Math.floor(def.value * rate));
}
