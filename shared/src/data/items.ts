/**
 * Item roster (data-driven, like mobs). The server reads stack limits, value,
 * equip slot, and bonuses from here; the client reads name + rarity for
 * rendering. Adding an item is a new entry — never a combat/inventory code edit
 * (kit rule #4).
 *
 * P3.1 ships a small starter set spanning every kind (currency, weapon, armor,
 * consumable, material). Equip bonuses are defined now but only *applied* in
 * P3.2; drops wire these into mob loot tables in P3.3.
 */

/** Quality tiers (GDD): Relics are server-news pre-Fall uniques. */
export type ItemRarity = "common" | "fine" | "rare" | "relic";

/**
 * Where an equippable item goes. A const tuple so the zod message schema
 * (`z.enum(EQUIP_SLOTS)`) and the `EquipSlot` union can never drift.
 */
export const EQUIP_SLOTS = [
  "weapon",
  "head",
  "body",
  "legs",
  "hands",
  "feet",
  "ring",
  "amulet",
] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

/** Flat combat-stat bonuses granted while an item is equipped (P3.2). */
export interface ItemBonus {
  attack?: number;
  strength?: number;
  defence?: number;
  maxHp?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  rarity: ItemRarity;
  /** Max units per stack: 1 = unstackable (gear), >1 = stackable. */
  maxStack: number;
  /** Base vendor value in coins — faucet/sink tuning anchor. */
  value: number;
  /** Slot it occupies when equippable (omitted = not equippable). */
  equipSlot?: EquipSlot;
  /** Combat bonuses applied while equipped (P3.2). */
  bonus?: ItemBonus;
  /** HP restored when consumed (consumables only). */
  heal?: number;
  /** Max durability for equippable gear — wears with use, repaired for coins
   *  (P8). Omitted = the item never wears (currency, materials, consumables). */
  maxDurability?: number;
  /** One-line tooltip flavor. */
  desc?: string;
}

const STACK_MAX = 2_147_483_647; // coins/materials stack effectively without limit

export const ITEMS: Record<string, ItemDef> = {
  // --- currency ---
  coins: {
    id: "coins",
    name: "Coins",
    rarity: "common",
    maxStack: STACK_MAX,
    value: 1,
    desc: "The realm's currency.",
  },

  // --- weapons ---
  bronze_sword: {
    id: "bronze_sword",
    name: "Bronze Sword",
    rarity: "common",
    maxStack: 1,
    value: 25,
    equipSlot: "weapon",
    bonus: { attack: 3, strength: 4 },
    maxDurability: 120,
    desc: "A starter blade. Better than fists.",
  },
  iron_sword: {
    id: "iron_sword",
    name: "Iron Sword",
    rarity: "fine",
    maxStack: 1,
    value: 120,
    equipSlot: "weapon",
    bonus: { attack: 6, strength: 8 },
    maxDurability: 200,
    desc: "Forged steel with a keen edge.",
  },

  // --- armor ---
  leather_body: {
    id: "leather_body",
    name: "Leather Body",
    rarity: "common",
    maxStack: 1,
    value: 30,
    equipSlot: "body",
    bonus: { defence: 4, maxHp: 6 },
    maxDurability: 150,
    desc: "Boiled hide. Stops a scratch.",
  },
  bronze_helm: {
    id: "bronze_helm",
    name: "Bronze Helm",
    rarity: "common",
    maxStack: 1,
    value: 18,
    equipSlot: "head",
    bonus: { defence: 2 },
    maxDurability: 120,
    desc: "Dented, but it does the job.",
  },

  // --- consumables ---
  health_potion: {
    id: "health_potion",
    name: "Health Potion",
    rarity: "common",
    maxStack: 20,
    value: 15,
    heal: 40,
    desc: "Restores 40 HP. Tastes of ash.",
  },

  // --- gathered materials (Mining ore + Fishing raw fish; P4) ---
  copper_ore: {
    id: "copper_ore",
    name: "Copper Ore",
    rarity: "common",
    maxStack: STACK_MAX,
    value: 3,
    desc: "Smelts with tin into bronze.",
  },
  tin_ore: {
    id: "tin_ore",
    name: "Tin Ore",
    rarity: "common",
    maxStack: STACK_MAX,
    value: 3,
    desc: "Smelts with copper into bronze.",
  },
  iron_ore: {
    id: "iron_ore",
    name: "Iron Ore",
    rarity: "common",
    maxStack: STACK_MAX,
    value: 10,
    desc: "Smelts into an iron bar.",
  },
  raw_shrimp: {
    id: "raw_shrimp",
    name: "Raw Shrimp",
    rarity: "common",
    maxStack: STACK_MAX,
    value: 2,
    desc: "Cook it before eating.",
  },
  raw_trout: {
    id: "raw_trout",
    name: "Raw Trout",
    rarity: "common",
    maxStack: STACK_MAX,
    value: 6,
    desc: "Cook it before eating.",
  },

  // --- smithing bars (Smelting output; forge into gear) ---
  bronze_bar: {
    id: "bronze_bar",
    name: "Bronze Bar",
    rarity: "common",
    maxStack: STACK_MAX,
    value: 12,
    desc: "Smithed from copper + tin. Forge it into gear.",
  },
  iron_bar: {
    id: "iron_bar",
    name: "Iron Bar",
    rarity: "common",
    maxStack: STACK_MAX,
    value: 30,
    desc: "Forge it into iron gear.",
  },

  // --- cooked food (Cooking output; eat to heal in combat) ---
  shrimp: {
    id: "shrimp",
    name: "Shrimp",
    rarity: "common",
    maxStack: 20,
    value: 4,
    heal: 4,
    desc: "Cooked. Restores 4 HP.",
  },
  trout: {
    id: "trout",
    name: "Trout",
    rarity: "common",
    maxStack: 20,
    value: 12,
    heal: 12,
    desc: "Cooked. Restores 12 HP.",
  },

  // --- pre-Fall valuables (Tanglewood drops; vendor treasure) ---
  ancient_relic: {
    id: "ancient_relic",
    name: "Ancient Relic",
    rarity: "rare",
    maxStack: STACK_MAX,
    value: 120,
    desc: "A shard of the Accord's works, still faintly warm. Collectors pay well.",
  },

  // --- Cinder Depths boss reward: a relic amulet (best neck slot so far) ---
  cinder_heart: {
    id: "cinder_heart",
    name: "Cinderheart Amulet",
    rarity: "relic",
    maxStack: 1,
    value: 600,
    equipSlot: "amulet",
    bonus: { attack: 6, strength: 8, defence: 4, maxHp: 20 },
    desc: "The still-burning core of the Warden of Ash. It beats when you fight.",
  },

  // --- Molten Throne raid relic (P12.1): the best weapon in the game ---
  molten_relic: {
    id: "molten_relic",
    name: "Blade of the Molten King",
    rarity: "relic",
    maxStack: 1,
    value: 2500,
    equipSlot: "weapon",
    bonus: { attack: 14, strength: 16 },
    maxDurability: 400,
    desc: "Forged in the Molten Throne. One per throne-breaker, per week.",
  },

  // --- materials (mob drops; feed Smithing/Cooking later) ---
  ash_pelt: {
    id: "ash_pelt",
    name: "Ash Pelt",
    rarity: "common",
    maxStack: STACK_MAX,
    value: 8,
    desc: "Singed wolf hide.",
  },
  emberling_fang: {
    id: "emberling_fang",
    name: "Emberling Fang",
    rarity: "common",
    maxStack: STACK_MAX,
    value: 5,
    desc: "Still faintly warm.",
  },
};

/** Look up an item definition, or undefined if the id is unknown. */
export function itemDef(id: string): ItemDef | undefined {
  return ITEMS[id];
}

/** All known item ids (for GM tooling / validation messages). */
export const ITEM_IDS = Object.keys(ITEMS);
