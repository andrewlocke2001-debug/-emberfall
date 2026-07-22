import type { ZoneId } from "./zones";

/**
 * NPCs (quest-givers + flavor), data-driven like banks and nodes. Each NPC is a
 * single placed instance with a greeting and the quests it gives/turns in.
 * The client renders markers + a dialogue panel from this data; the server
 * validates proximity for "talk" and quest actions. Full branching dialogue
 * trees are a later enhancement — v1 is a greeting + quest options.
 */
export interface NpcDef {
  id: string;
  name: string;
  zone: ZoneId;
  x: number;
  y: number;
  /** Shown when you open the conversation. */
  greeting: string;
  /** Quest ids this NPC offers / accepts turn-ins for. */
  quests: string[];
  /** Client render tint. */
  color: number;
}

export const NPCS: Record<string, NpcDef> = {
  hearthwarden_mira: {
    id: "hearthwarden_mira",
    name: "Warden Mira",
    zone: "meadowbrook",
    x: 560,
    y: 464,
    greeting:
      "Welcome to Meadowbrook, stranger. The frontier's hard, but we look after our own. Make yourself useful and you'll do fine.",
    quests: ["greet_mira", "miners_welcome", "supper_for_the_inn", "thin_the_pack", "the_ember_scar"],
    color: 0x6fae8f,
  },
  quartermaster_hale: {
    id: "quartermaster_hale",
    name: "Quartermaster Hale",
    zone: "marrowgate_downs",
    x: 752,
    y: 1520,
    greeting:
      "Mind the lights, traveller — they were people once, and the cold hasn't finished with them. The League pays for anything that thins the barrows. It does not pay for questions about the town.",
    quests: ["the_quarantine_line", "wax_for_the_wardens", "the_barred_door"],
    color: 0x8fa3ae,
  },
  charterwright_essa: {
    id: "charterwright_essa",
    name: "Charterwright Essa",
    zone: "vossmere",
    x: 880,
    y: 1360,
    greeting:
      "Welcome to the wet end of the world. The Shoremade are building something here — planks, charters, a future — and the sea keeps sending crabs, shades and thieves to eat it. Care to earn your keep?",
    quests: ["planks_over_water", "the_wake_paid"],
    color: 0x6f9aa8,
  },
  rite_keeper_brunna: {
    id: "rite_keeper_brunna",
    name: "Rite-Keeper Brunna",
    zone: "dolmholt",
    x: 1168,
    y: 1296,
    greeting:
      "Ask first. Cut second. The Open-Vein skip the asking, and now the deep is answering — you hear it too, don't pretend otherwise. The hold pays for order, stranger, and carves what it owes.",
    quests: ["the_unlawful_cut", "ore_for_the_asking"],
    color: 0x9aa3a8,
  },
  tender_ilse: {
    id: "tender_ilse",
    name: "Tender Ilse",
    zone: "cinderfen",
    x: 528,
    y: 1552,
    greeting:
      "Feel the ground? Warm. The fen weeps at night and the Order calls it yield. We call it a wound. Help the tending and I'll pay you — with coin, since the Ember can't thank you itself. Yet.",
    quests: ["the_fen_bleeds", "amber_for_the_tending"],
    color: 0x7fae8e,
  },
  cache_factor_merrin: {
    id: "cache_factor_merrin",
    name: "Cache-Factor Merrin",
    zone: "graywastes",
    x: 208,
    y: 976,
    greeting:
      "The Order sells cache predictions; I collect what comes back. The reavers rob my expeditions, the cold takes the rest, and that Beacon on the rise gives light the way a debt gives comfort. Work for coin?",
    quests: ["the_cold_ledger", "what_the_beacon_gathers"],
    color: 0x8f9aa8,
  },
  huntmaster_veyra: {
    id: "huntmaster_veyra",
    name: "Huntmaster Veyra",
    zone: "meadowbrook",
    x: 592,
    y: 464,
    greeting: "The wilds are overrun. Take a hunt, cull the worst of them, and I'll pay in kind.",
    quests: [],
    color: 0xb8624e,
  },
  smith_dorin: {
    id: "smith_dorin",
    name: "Dorin the Smith",
    zone: "meadowbrook",
    x: 656,
    y: 464,
    greeting:
      "Bronze won't smith itself. Bring me ore and I'll show you the forge — a blade you made beats a blade you found.",
    quests: ["forge_proven"],
    color: 0xc28b4e,
  },
  battlemaster_kor: {
    id: "battlemaster_kor",
    name: "Battlemaster Kor",
    zone: "meadowbrook",
    x: 560,
    y: 528,
    greeting:
      "Steel sharpens steel. Queue up for the Proving Grounds and show me what the frontier taught you.",
    quests: [],
    color: 0x991b1b,
  },
  stabler_bran: {
    id: "stabler_bran",
    name: "Bran the Stabler",
    zone: "meadowbrook",
    x: 624,
    y: 528,
    greeting:
      "Tired of walking the frontier? A good elk'll carry you twice as fast. Buy one once and it's yours for good.",
    quests: [],
    color: 0x8a6d3b,
  },
};

export function npcDef(id: string): NpcDef | undefined {
  return NPCS[id];
}

/** All NPCs placed in a given zone. */
export function npcsInZone(zoneId: string): NpcDef[] {
  return Object.values(NPCS).filter((n) => n.zone === zoneId);
}
