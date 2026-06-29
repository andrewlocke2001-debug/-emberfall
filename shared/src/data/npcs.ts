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
    quests: ["greet_mira", "miners_welcome", "thin_the_pack"],
    color: 0x6fae8f,
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
};

export function npcDef(id: string): NpcDef | undefined {
  return NPCS[id];
}

/** All NPCs placed in a given zone. */
export function npcsInZone(zoneId: string): NpcDef[] {
  return Object.values(NPCS).filter((n) => n.zone === zoneId);
}
