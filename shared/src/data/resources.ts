import type { SkillId } from "../types";
import type { ZoneId } from "./zones";

/**
 * Gathering resources (Mining rocks, Fishing spots) — data-driven like mobs and
 * banks. A node yields one item per ~gatherMs of standing on it; nodes are
 * per-player and don't deplete (no contention), so they're static placements
 * the client renders from this data and the server validates gathers against
 * (no synced schema needed). Adding a node is a one-line edit.
 */
export interface ResourceDef {
  type: string;
  /** Which skill trains, and gates this node. */
  skill: Extract<SkillId, "mining" | "fishing">;
  name: string;
  /** Item produced per successful gather. */
  itemId: string;
  /** Skill XP per gather. */
  xp: number;
  /** Minimum skill level to gather here. */
  levelReq: number;
  /** Milliseconds of gathering per yield (the relaxed, semi-AFK rhythm). */
  gatherMs: number;
  /** Client render tint. */
  color: number;
}

export const RESOURCES: Record<string, ResourceDef> = {
  copper_rock: {
    type: "copper_rock",
    skill: "mining",
    name: "Copper Rock",
    itemId: "copper_ore",
    xp: 8,
    levelReq: 1,
    gatherMs: 2400,
    color: 0xc8783c,
  },
  tin_rock: {
    type: "tin_rock",
    skill: "mining",
    name: "Tin Rock",
    itemId: "tin_ore",
    xp: 8,
    levelReq: 1,
    gatherMs: 2400,
    color: 0xa6a6a6,
  },
  iron_rock: {
    type: "iron_rock",
    skill: "mining",
    name: "Iron Rock",
    itemId: "iron_ore",
    xp: 18,
    levelReq: 10,
    gatherMs: 3000,
    color: 0x8a6a52,
  },
  shrimp_spot: {
    type: "shrimp_spot",
    skill: "fishing",
    name: "Shrimp Spot",
    itemId: "raw_shrimp",
    xp: 6,
    levelReq: 1,
    gatherMs: 2400,
    color: 0x6fd1ff,
  },
  trout_spot: {
    type: "trout_spot",
    skill: "fishing",
    name: "Trout Spot",
    itemId: "raw_trout",
    xp: 16,
    levelReq: 15,
    gatherMs: 3000,
    color: 0x4f9bd1,
  },
};

/** A placed node in the world. */
export interface ResourceNode {
  id: string;
  type: string;
  x: number;
  y: number;
}

export const NODES: Partial<Record<ZoneId, ResourceNode[]>> = {
  // Town starter resources: rocks at the south outskirts, fishing at the pond.
  meadowbrook: [
    { id: "copper-1", type: "copper_rock", x: 304, y: 1072 },
    { id: "tin-1", type: "tin_rock", x: 336, y: 1072 },
    { id: "shrimp-1", type: "shrimp_spot", x: 880, y: 496 },
  ],
  // Greenreach wilds: more mining + the trout fishing for the cook loop.
  greenreach: [
    { id: "copper-1", type: "copper_rock", x: 320, y: 320 },
    { id: "tin-1", type: "tin_rock", x: 360, y: 320 },
    { id: "iron-1", type: "iron_rock", x: 400, y: 360 },
    { id: "trout-1", type: "trout_spot", x: 240, y: 980 },
  ],
  // Marrowgate Downs: iron among the barrows (the band matches mining 10)
  // + cold-pond trout by the south-east shore.
  marrowgate_downs: [
    { id: "iron-1", type: "iron_rock", x: 464, y: 816 },
    { id: "iron-2", type: "iron_rock", x: 1456, y: 752 },
    { id: "copper-1", type: "copper_rock", x: 528, y: 1264 },
    { id: "trout-1", type: "trout_spot", x: 1392, y: 1616 },
  ],
  // The Vossmere: the fishing capital (two trout runs + shrimp) with a
  // little metal on the high ground.
  vossmere: [
    { id: "trout-1", type: "trout_spot", x: 400, y: 1504 },
    { id: "trout-2", type: "trout_spot", x: 1424, y: 1552 },
    { id: "shrimp-1", type: "shrimp_spot", x: 1072, y: 1408 },
    { id: "iron-1", type: "iron_rock", x: 1616, y: 784 },
    { id: "tin-1", type: "tin_rock", x: 400, y: 656 },
  ],
  // Tanglewood: richer iron in the north glade + trout at the wraith pond
  // (the pond is guarded — better yield lives behind danger).
  tanglewood: [
    { id: "iron-1", type: "iron_rock", x: 880, y: 400 },
    { id: "iron-2", type: "iron_rock", x: 944, y: 400 },
    { id: "trout-1", type: "trout_spot", x: 1360, y: 1552 },
  ],
  // The Ashreach (PvP risk zone): the densest resources in the game — the
  // reward that justifies the risk. Caldera center + by the cinder pools.
  ashreach: [
    { id: "iron-1", type: "iron_rock", x: 832, y: 704 },
    { id: "iron-2", type: "iron_rock", x: 880, y: 704 },
    { id: "iron-3", type: "iron_rock", x: 928, y: 704 },
    { id: "trout-1", type: "trout_spot", x: 768, y: 560 },
  ],
};

/** Resolve a node id in a zone to its placement + definition. */
export function resourceNode(
  zoneId: string,
  nodeId: string,
): { node: ResourceNode; def: ResourceDef } | undefined {
  const node = NODES[zoneId as ZoneId]?.find((n) => n.id === nodeId);
  if (!node) return undefined;
  const def = RESOURCES[node.type];
  if (!def) return undefined;
  return { node, def };
}
