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

import type { WeaponType } from "../types";

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
  /** Weapon class (P13): decides the governing combat skill + usable kit. */
  weaponType?: WeaponType;
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
    weaponType: "sword",
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
    weaponType: "sword",
    desc: "Forged steel with a keen edge.",
  },
  bronze_axe: {
    id: "bronze_axe",
    name: "Bronze Axe",
    rarity: "common",
    maxStack: 1,
    value: 25,
    equipSlot: "weapon",
    bonus: { attack: 2, strength: 6 },
    maxDurability: 120,
    weaponType: "axe",
    desc: "Heavy-headed. Swings wide, lands hard.",
  },
  iron_axe: {
    id: "iron_axe",
    name: "Iron Axe",
    rarity: "fine",
    maxStack: 1,
    value: 120,
    equipSlot: "weapon",
    bonus: { attack: 4, strength: 12 },
    maxDurability: 200,
    weaponType: "axe",
    desc: "A woodsman's answer to most problems.",
  },
  bronze_dagger: {
    id: "bronze_dagger",
    name: "Bronze Dagger",
    rarity: "common",
    maxStack: 1,
    value: 25,
    equipSlot: "weapon",
    bonus: { attack: 5, strength: 2 },
    maxDurability: 120,
    weaponType: "dagger",
    desc: "Quick and precise. Finds the gaps.",
  },
  iron_dagger: {
    id: "iron_dagger",
    name: "Iron Dagger",
    rarity: "fine",
    maxStack: 1,
    value: 120,
    equipSlot: "weapon",
    bonus: { attack: 9, strength: 4 },
    maxDurability: 200,
    weaponType: "dagger",
    desc: "Barely a whisper going in.",
  },
  shortbow: {
    id: "shortbow",
    name: "Shortbow",
    rarity: "common",
    maxStack: 1,
    value: 25,
    equipSlot: "weapon",
    bonus: { attack: 3, strength: 4 },
    maxDurability: 120,
    weaponType: "bow",
    desc: "Strung frontier yew. Trains the Ranged skill.",
  },
  hunter_longbow: {
    id: "hunter_longbow",
    name: "Hunter's Longbow",
    rarity: "fine",
    maxStack: 1,
    value: 120,
    equipSlot: "weapon",
    bonus: { attack: 6, strength: 8 },
    maxDurability: 200,
    weaponType: "bow",
    desc: "Tanglewood work — it remembers being a tree.",
  },
  ember_staff: {
    id: "ember_staff",
    name: "Ember Staff",
    rarity: "common",
    maxStack: 1,
    value: 25,
    equipSlot: "weapon",
    bonus: { attack: 3, strength: 4 },
    maxDurability: 120,
    weaponType: "staff",
    desc: "A kindling focus. Trains the Magic skill.",
  },
  cinder_staff: {
    id: "cinder_staff",
    name: "Cinder Staff",
    rarity: "fine",
    maxStack: 1,
    value: 120,
    equipSlot: "weapon",
    bonus: { attack: 6, strength: 8 },
    maxDurability: 200,
    weaponType: "staff",
    desc: "Cored with live cinder. It hums when the fen weeps.",
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


  // --- P15.3 armour: fill legs/hands/feet/ring across the tiers ---
  // Leather set (beast drops + quest — NOT crafted; no leatherworking skill).
  leather_legs: {
    id: "leather_legs", name: "Leather Legs", rarity: "common", maxStack: 1, value: 24,
    equipSlot: "legs", bonus: { defence: 3, maxHp: 4 }, maxDurability: 150,
    desc: "Boiled-hide leggings. Beast-drop leather.",
  },
  leather_gloves: {
    id: "leather_gloves", name: "Leather Gloves", rarity: "common", maxStack: 1, value: 16,
    equipSlot: "hands", bonus: { defence: 2 }, maxDurability: 120,
    desc: "Supple and quiet. Keeps the cold off your fingers.",
  },
  leather_boots: {
    id: "leather_boots", name: "Leather Boots", rarity: "common", maxStack: 1, value: 16,
    equipSlot: "feet", bonus: { defence: 2, maxHp: 2 }, maxDurability: 120,
    desc: "Sturdy frontier boots.",
  },
  // Iron set (smithing + humanoid drops).
  iron_helm: {
    id: "iron_helm", name: "Iron Helm", rarity: "fine", maxStack: 1, value: 90,
    equipSlot: "head", bonus: { defence: 6, maxHp: 4 }, maxDurability: 200,
    desc: "Full iron. Rings when struck.",
  },
  iron_platebody: {
    id: "iron_platebody", name: "Iron Platebody", rarity: "fine", maxStack: 1, value: 200,
    equipSlot: "body", bonus: { defence: 10, maxHp: 14 }, maxDurability: 220,
    desc: "A smith's proudest plate.",
  },
  iron_legs: {
    id: "iron_legs", name: "Iron Legs", rarity: "fine", maxStack: 1, value: 140,
    equipSlot: "legs", bonus: { defence: 7, maxHp: 6 }, maxDurability: 200,
    desc: "Plated greaves. Heavy, but they hold.",
  },
  iron_gauntlets: {
    id: "iron_gauntlets", name: "Iron Gauntlets", rarity: "fine", maxStack: 1, value: 80,
    equipSlot: "hands", bonus: { defence: 5, strength: 2 }, maxDurability: 180,
    desc: "A closed fist of iron.",
  },
  iron_boots: {
    id: "iron_boots", name: "Iron Boots", rarity: "fine", maxStack: 1, value: 80,
    equipSlot: "feet", bonus: { defence: 4, maxHp: 4 }, maxDurability: 180,
    desc: "Iron-shod. You will not be moved.",
  },
  // Mauls (fills the unused maul weapon class; smithing).
  bronze_maul: {
    id: "bronze_maul", name: "Bronze Maul", rarity: "common", maxStack: 1, value: 30,
    equipSlot: "weapon", bonus: { attack: 1, strength: 8 }, maxDurability: 120,
    weaponType: "maul", desc: "All head, no finesse. Trains Melee.",
  },
  iron_maul: {
    id: "iron_maul", name: "Iron Maul", rarity: "fine", maxStack: 1, value: 130,
    equipSlot: "weapon", bonus: { attack: 2, strength: 16 }, maxDurability: 200,
    weaponType: "maul", desc: "A door in one hand, a wall in the other.",
  },
  // Rings (drops + hunt shop + quest; jewelry never wears).
  copper_ring: {
    id: "copper_ring", name: "Copper Ring", rarity: "common", maxStack: 1, value: 30,
    equipSlot: "ring", bonus: { strength: 2 }, desc: "A plain band with a warm sheen.",
  },
  iron_ring: {
    id: "iron_ring", name: "Iron Ring", rarity: "fine", maxStack: 1, value: 80,
    equipSlot: "ring", bonus: { strength: 3, defence: 2 }, desc: "Simple, solid, dependable.",
  },
  band_of_embers: {
    id: "band_of_embers", name: "Band of Embers", rarity: "rare", maxStack: 1, value: 200,
    equipSlot: "ring", bonus: { attack: 4, strength: 4 }, desc: "It stays warm even in the Graywastes.",
  },

  // --- P15.3 boss uniques: one per boss, endgame-chunky (feeds P15.5) ---
  broodmother_carapace: {
    id: "broodmother_carapace", name: "Broodmother's Carapace", rarity: "rare", maxStack: 1, value: 800,
    equipSlot: "body", bonus: { defence: 16, maxHp: 45 }, maxDurability: 400,
    desc: "Chitin still warm from the nest. Turns blades.",
  },
  colossus_greaves: {
    id: "colossus_greaves", name: "Colossus Greaves", rarity: "rare", maxStack: 1, value: 800,
    equipSlot: "legs", bonus: { defence: 14, strength: 6, maxHp: 30 }, maxDurability: 400,
    desc: "Obsidian slabs bound to the leg. You do not stagger.",
  },
  shadestep_boots: {
    id: "shadestep_boots", name: "Shade-Step Boots", rarity: "rare", maxStack: 1, value: 700,
    equipSlot: "feet", bonus: { attack: 6, strength: 8, maxHp: 15 }, maxDurability: 350,
    desc: "You arrive from the cold side of the fire.",
  },
  heralds_gauntlets: {
    id: "heralds_gauntlets", name: "Herald's Gauntlets", rarity: "rare", maxStack: 1, value: 750,
    equipSlot: "hands", bonus: { attack: 8, strength: 10 }, maxDurability: 350,
    desc: "Every blow you land carries the Herald's call.",
  },
  molten_crown: {
    id: "molten_crown", name: "Crown of the Molten King", rarity: "relic", maxStack: 1, value: 2000,
    equipSlot: "head", bonus: { attack: 6, strength: 8, defence: 10, maxHp: 40 }, maxDurability: 500,
    desc: "It sits warm on the brow, and dreams of a kingdom that never had a hard winter.",
  },
  cinderheart_signet: {
    id: "cinderheart_signet", name: "Cinderheart Signet", rarity: "rare", maxStack: 1, value: 600,
    equipSlot: "ring", bonus: { attack: 5, strength: 5, defence: 3 }, desc: "The Warden's seal. It beats when you fight.",
  },
  gatewright_keyring: {
    id: "gatewright_keyring", name: "Gatewright's Keyring", rarity: "rare", maxStack: 1, value: 300,
    equipSlot: "ring", bonus: { defence: 6, maxHp: 20 }, desc: "Keys to doors that were barred from the inside.",
  },
  deepdelver_band: {
    id: "deepdelver_band", name: "Deepdelver Band", rarity: "rare", maxStack: 1, value: 260,
    equipSlot: "ring", bonus: { strength: 6, maxHp: 12 }, desc: "Carved by a hand that asked the stone first.",
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
    value: 8,
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

  crab_meat: {
    id: "crab_meat",
    name: "Crab Meat",
    rarity: "common",
    maxStack: 2_147_483_647,
    value: 5,
    desc: "Sweet, cold-water crab. Cook it before eating.",
  },
  dressed_crab: {
    id: "dressed_crab",
    name: "Dressed Crab",
    rarity: "common",
    maxStack: 20,
    value: 14,
    heal: 55,
    desc: "Restores 55 HP. A Vossari dockside delicacy.",
  },
  sea_wrack: {
    id: "sea_wrack",
    name: "Sea Wrack",
    rarity: "common",
    maxStack: 2_147_483_647,
    value: 6,
    desc: "Salt-heavy weed. Burned in Wake-Paying rites; good in a crab boil.",
  },
  fen_amber: {
    id: "fen_amber",
    name: "Fen Amber",
    rarity: "common",
    maxStack: 2_147_483_647,
    value: 9,
    desc: "Vitrified sap from the scar-fen. Warm long after dark.",
  },
  shard_of_the_beacon: {
    id: "shard_of_the_beacon", name: "Shard of the Beacon", rarity: "rare", maxStack: 1, value: 700,
    equipSlot: "amulet", bonus: { attack: 7, strength: 7, maxHp: 15 },
    desc: "A sliver of the black lamp. It is warm, and it is wrong. (2 of 9.)",
  },
  lamp_glass: {
    id: "lamp_glass", name: "Lamp Glass", rarity: "common", maxStack: 2_147_483_647, value: 12,
    desc: "Glass from the capital's melted lamps. It still refuses to go fully dark.",
  },
  lamplighter_staff: {
    id: "lamplighter_staff", name: "Lamplighter's Staff", rarity: "rare", maxStack: 1, value: 800,
    equipSlot: "weapon", bonus: { attack: 9, strength: 12 }, maxDurability: 300,
    weaponType: "staff",
    desc: "An Archive underwarden's rod. The ferrule is still warm from work nobody admits to.",
  },
  ember_tear: {
    id: "ember_tear", name: "Ember Tear", rarity: "common", maxStack: 2_147_483_647, value: 15,
    desc: "A bead of the Ember's grief, cooled mid-fall. Warm a century on.",
  },
  wound_walker_boots: {
    id: "wound_walker_boots", name: "Wound-Walker Boots", rarity: "relic", maxStack: 1, value: 1500,
    equipSlot: "feet", bonus: { attack: 8, strength: 10, defence: 6, maxHp: 20 }, maxDurability: 500,
    desc: "They remember every step the fire took. Compasses point at them.",
  },
  oarblade: {
    id: "oarblade", name: "Oarblade", rarity: "rare", maxStack: 1, value: 350,
    equipSlot: "weapon", bonus: { attack: 8, strength: 10 }, maxDurability: 300,
    weaponType: "sword",
    desc: "An oar the Wall refused, ground to an edge. It rows through people now.",
  },
  bell_maul: {
    id: "bell_maul", name: "The Foreman's Bell", rarity: "rare", maxStack: 1, value: 500,
    equipSlot: "weapon", bonus: { attack: 4, strength: 18 }, maxDurability: 350,
    weaponType: "maul",
    desc: "The shift-bell, hafted. It still rings the hours; the hours are wrong.",
  },
  barrow_lantern: {
    id: "barrow_lantern",
    name: "Barrow Lantern",
    rarity: "rare",
    maxStack: 1,
    value: 90,
    equipSlot: "amulet",
    bonus: { defence: 2, maxHp: 12 },
    desc: "The Gatewright's lamp. It shines, but casts no warmth — and no shadow.",
  },
  grave_wax: {
    id: "grave_wax",
    name: "Grave Wax",
    rarity: "common",
    maxStack: STACK_MAX,
    value: 5,
    desc: "Cold tallow scraped from barrow-lights. Burns without heat.",
  },

  // --- smithing bars (Smelting output; forge into gear) ---
  bronze_bar: {
    id: "bronze_bar",
    name: "Bronze Bar",
    rarity: "common",
    maxStack: STACK_MAX,
    value: 8,
    desc: "Smithed from copper + tin. Forge it into gear.",
  },
  iron_bar: {
    id: "iron_bar",
    name: "Iron Bar",
    rarity: "common",
    maxStack: STACK_MAX,
    value: 12,
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
    weaponType: "sword",
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
