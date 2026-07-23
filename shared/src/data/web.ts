import type { CallingId, TalentEffects } from "./callings";
import { CALLING_IDS } from "./callings";

/**
 * The Passive Web (P15.2) — one shared allocation graph in the spirit of
 * Path of Exile's tree, replacing the six siloed Calling trees. Your Calling
 * decides WHERE you start on the wheel; from there you allocate any node
 * ADJACENT to one you already own. Five travel layers let builds cross
 * class territory: the innermost hexagon, the center ring, the gate arcs,
 * the six spokes, and the outer rim road linking crown regions.
 *
 * The graph is BUILT here (data-as-code, like the map painters): six 60°
 * sectors of 34 nodes (204 total, doubled in P19), each with an inward path
 * to the center ring, an outward spine to a keystone AND a crown keystone
 * beyond it, two flavored branches with a notable at each tip, and a deep
 * fork past each branch ending in a deep notable. All nodes are rank 1
 * (PoE-style): the build is the SHAPE of your allocation.
 */

export type WebNodeKind = "small" | "notable" | "keystone";

export interface WebNode {
  id: string;
  name: string;
  desc: string;
  kind: WebNodeKind;
  /** Layout position (web-space px, center at 0,0) for the K-panel render. */
  x: number;
  y: number;
  effects: TalentEffects;
}

export const WEB_NODES: Record<string, WebNode> = {};
export const WEB_EDGES: [string, string][] = [];
/** Where each Calling enters the web. */
export const WEB_STARTS: Record<CallingId, string> = {} as Record<CallingId, string>;

/** Per-sector flavor: smalls, branch notables, deep notables, two keystones. */
const FLAVOR: Record<
  CallingId,
  {
    smalls: { name: string; effects: TalentEffects }[];
    notableL: { name: string; effects: TalentEffects };
    notableR: { name: string; effects: TalentEffects };
    deepL: { name: string; effects: TalentEffects };
    deepR: { name: string; effects: TalentEffects };
    keystone: { name: string; desc: string; effects: TalentEffects };
    crown: { name: string; desc: string; effects: TalentEffects };
  }
> = {
  warden: {
    smalls: [
      { name: "Braced", effects: { defencePct: 3 } },
      { name: "Hearty", effects: { maxHpFlat: 8 } },
    ],
    notableL: { name: "Shield-Wall", effects: { defencePct: 6, maxHpFlat: 12 } },
    notableR: { name: "Hearthstone Skin", effects: { maxHpFlat: 20 } },
    keystone: {
      name: "The Thousand Hearths",
      desc: "You are the wall the frontier sleeps behind.",
      effects: { defencePct: 10, maxHpFlat: 30 },
    },
    deepL: { name: "Bulwark Oath", effects: { defencePct: 5, maxHpFlat: 12 } },
    deepR: { name: "Ember-Tended Scars", effects: { maxHpFlat: 14, lifesteal: 1 } },
    crown: {
      name: "The Unbroken Line",
      desc: "The wall outlives the war.",
      effects: { defencePct: 12, maxHpFlat: 40 },
    },
  },
  reaver: {
    smalls: [
      { name: "Savage", effects: { strengthPct: 3 } },
      { name: "Bloodletter", effects: { executePct: 4 } },
    ],
    notableL: { name: "Overdrawn Fury", effects: { strengthPct: 6, executePct: 6 } },
    notableR: { name: "Gravedigger", effects: { executePct: 10 } },
    keystone: {
      name: "The Red Season",
      desc: "What falls below the waterline does not come back up.",
      effects: { strengthPct: 8, executePct: 12 },
    },
    deepL: { name: "Wet Work", effects: { strengthPct: 5, lifesteal: 1 } },
    deepR: { name: "No Quarter", effects: { executePct: 8, strengthPct: 3 } },
    crown: {
      name: "The Drowned Court",
      desc: "Everything sinks if you hold it down long enough.",
      effects: { strengthPct: 10, lifesteal: 2 },
    },
  },
  strider: {
    smalls: [
      { name: "Steady Hand", effects: { attackPct: 3 } },
      { name: "Keen Eye", effects: { critChance: 1 } },
    ],
    notableL: { name: "Marked Quarry", effects: { attackPct: 6, critChance: 2 } },
    notableR: { name: "Threaded Needle", effects: { critChance: 3 } },
    keystone: {
      name: "Deadeye",
      desc: "The arrow was always going to land there.",
      effects: { attackPct: 6, critChance: 5 },
    },
    deepL: { name: "Windage", effects: { attackPct: 5, gcdPct: 2 } },
    deepR: { name: "Second Shaft", effects: { critChance: 2, attackPct: 4 } },
    crown: {
      name: "The Longest Shot",
      desc: "Loosed yesterday, landing tomorrow.",
      effects: { attackPct: 8, critChance: 4 },
    },
  },
  cinderwright: {
    smalls: [
      { name: "Kindled", effects: { strengthPct: 3 } },
      { name: "Efficient Draw", effects: { energyCostPct: 2 } },
    ],
    notableL: { name: "Roaring Draft", effects: { strengthPct: 6, energyCostPct: 4 } },
    notableR: { name: "Banked Breath", effects: { energyCostPct: 6 } },
    keystone: {
      name: "The Everlamp",
      desc: "A flame that pays its own fuel.",
      effects: { strengthPct: 8, energyCostPct: 8 },
    },
    deepL: { name: "Overstoked", effects: { strengthPct: 6, energyCostPct: 2 } },
    deepR: { name: "Slow Coals", effects: { energyCostPct: 5, maxHpFlat: 10 } },
    crown: {
      name: "The Furnace Heart",
      desc: "It burns because you tell it to.",
      effects: { strengthPct: 10, energyCostPct: 10 },
    },
  },
  hearthmender: {
    smalls: [
      { name: "Warm Hands", effects: { healPowerPct: 4 } },
      { name: "Stoked Vigil", effects: { maxHpFlat: 8 } },
    ],
    notableL: { name: "Shared Fire", effects: { healPowerPct: 8, maxHpFlat: 10 } },
    notableR: { name: "Tender's Patience", effects: { healPowerPct: 12 } },
    keystone: {
      name: "Rekindler",
      desc: "No spark goes down the flue on your watch.",
      effects: { healPowerPct: 15, maxHpFlat: 25 },
    },
    deepL: { name: "Poultice Lore", effects: { healPowerPct: 8, energyCostPct: 2 } },
    deepR: { name: "Vigil's Reward", effects: { maxHpFlat: 16, healPowerPct: 4 } },
    crown: {
      name: "The Long Watch",
      desc: "Dawn is a promise you keep.",
      effects: { healPowerPct: 18, maxHpFlat: 30 },
    },
  },
  ashwalker: {
    smalls: [
      { name: "Cold Read", effects: { critChance: 1.5 } },
      { name: "Quickened", effects: { gcdPct: 1 } },
    ],
    notableL: { name: "Opportunist", effects: { critChance: 3, gcdPct: 2 } },
    notableR: { name: "Ash Veil", effects: { gcdPct: 4 } },
    keystone: {
      name: "The Quench",
      desc: "Strike from the cold side of the fire.",
      effects: { critChance: 6, gcdPct: 4 },
    },
    deepL: { name: "Smoke Discipline", effects: { gcdPct: 3, critChance: 1 } },
    deepR: { name: "Grave-Quiet", effects: { critChance: 3, lifesteal: 1 } },
    crown: {
      name: "The Second Shadow",
      desc: "You arrive before your footsteps.",
      effects: { critChance: 5, gcdPct: 5 },
    },
  },
};

const node = (
  id: string,
  name: string,
  kind: WebNodeKind,
  x: number,
  y: number,
  effects: TalentEffects,
  desc = "",
): string => {
  WEB_NODES[id] = { id, name, desc, kind, x: Math.round(x), y: Math.round(y), effects };
  return id;
};
const edge = (a: string, b: string): void => {
  WEB_EDGES.push([a, b]);
};
const at = (angleDeg: number, radius: number): { x: number; y: number } => {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
};

// --- build the wheel: six sectors, 60° apart, Calling order around the face
CALLING_IDS.forEach((calling, i) => {
  const A = i * 60;
  const f = FLAVOR[calling];
  const cap = calling.charAt(0).toUpperCase() + calling.slice(1);
  const small = (n: number): { name: string; effects: TalentEffects } => f.smalls[n % 2]!;

  const p = (deg: number, r: number, suffix: string, kind: WebNodeKind, fl: { name: string; effects: TalentEffects }, desc = "") => {
    const { x, y } = at(deg, r);
    return node(`w_${calling}_${suffix}`, fl.name, kind, x, y, fl.effects, desc);
  };

  // Center ring (cheap mixed travel) and the inward path.
  const ring = p(A, 70, "ring", "small", { name: "Crossroads", effects: { maxHpFlat: 4 } });
  const in2 = p(A, 115, "in2", "small", small(0));
  const in1 = p(A, 160, "in1", "small", small(1));
  // The gate: where this Calling enters the web.
  const start = p(A, 205, "start", "notable", {
    name: `${cap}'s Gate`,
    effects: f.smalls[0]!.effects,
  }, "Where your road begins.");
  WEB_STARTS[calling] = start;

  // The spine out toward the keystone.
  const s1 = p(A, 250, "s1", "small", small(0));
  const s2 = p(A, 295, "s2", "small", small(1));
  const s3 = p(A, 340, "s3", "small", small(0));
  const s4 = p(A, 385, "s4", "small", small(1));
  const key = p(A, 430, "key", "keystone", f.keystone, f.keystone.desc);

  edge(ring, in2);
  edge(in2, in1);
  edge(in1, start);
  edge(start, s1);
  edge(s1, s2);
  edge(s2, s3);
  edge(s3, s4);
  edge(s4, key);

  // Two flavored branches off the spine, a notable at each tip.
  const lb1 = p(A - 13, 315, "l1", "small", small(0));
  const lb2 = p(A - 23, 335, "l2", "small", small(1));
  const lb3 = p(A - 33, 355, "l3", "small", small(0));
  const lN = p(A - 42, 375, "ln", "notable", f.notableL);
  edge(s2, lb1);
  edge(lb1, lb2);
  edge(lb2, lb3);
  edge(lb3, lN);

  const rb1 = p(A + 13, 315, "r1", "small", small(1));
  const rb2 = p(A + 23, 335, "r2", "small", small(0));
  const rb3 = p(A + 33, 355, "r3", "small", small(1));
  const rN = p(A + 42, 375, "rn", "notable", f.notableR);
  edge(s2, rb1);
  edge(rb1, rb2);
  edge(rb2, rb3);
  edge(rb3, rN);

  // --- the doubled web (P19): four new layers per sector ---

  // Hearthside spur: the innermost hexagon, hanging inside the center ring.
  const spur = p(A, 40, "spur", "small", { name: "Hearthside", effects: { maxHpFlat: 6 } });
  edge(ring, spur);

  // Mid-spurs: flavored pockets off the inward path.
  const midL = p(A - 14, 137, "ml", "small", small(0));
  const midR = p(A + 14, 137, "mr", "small", small(1));
  edge(in1, midL);
  edge(in2, midR);

  // The gate arc: lateral travel at gate radius toward the NEXT gate.
  const arcA = p(A + 20, 200, "aa", "small", { name: "Waymark", effects: { maxHpFlat: 4 } });
  const arcB = p(A + 40, 200, "ab", "small", { name: "Waymark", effects: { maxHpFlat: 4 } });
  edge(start, arcA);
  edge(arcA, arcB);

  // Deep branches: a fork past each branch tip, ending in a deep notable.
  const dl1 = p(A - 30, 385, "dl1", "small", small(1));
  const dl2 = p(A - 36, 410, "dl2", "small", small(0));
  const dlN = p(A - 42, 435, "dln", "notable", f.deepL);
  edge(lb3, dl1);
  edge(dl1, dl2);
  edge(dl2, dlN);
  const dr1 = p(A + 30, 385, "dr1", "small", small(0));
  const dr2 = p(A + 36, 410, "dr2", "small", small(1));
  const drN = p(A + 42, 435, "drn", "notable", f.deepR);
  edge(rb3, dr1);
  edge(dr1, dr2);
  edge(dr2, drN);

  // The crown: a second keystone past the first, reached by a diamond.
  const k1 = p(A - 6, 475, "k1", "small", small(0));
  const k2 = p(A + 6, 475, "k2", "small", small(1));
  const crown = p(A, 520, "crown", "keystone", f.crown, f.crown.desc);
  edge(key, k1);
  edge(key, k2);
  edge(k1, crown);
  edge(k2, crown);

  // The rim road: crown-to-crown travel, with spans up from the deep forks.
  const rim = p(A + 30, 505, "rim", "small", { name: "The Rim-Road", effects: { maxHpFlat: 4 } });
  const bridgeR = p(A + 38, 470, "br", "small", { name: "Span", effects: { maxHpFlat: 4 } });
  const bridgeL = p(A - 38, 470, "bl", "small", { name: "Span", effects: { maxHpFlat: 4 } });
  edge(crown, rim);
  edge(drN, bridgeR);
  edge(bridgeR, rim);
  edge(dlN, bridgeL);
});

// Ring travel: the center hexagon, and the rim links between sectors
// (sector i's RIGHT notable meets sector i+1's LEFT notable).
CALLING_IDS.forEach((calling, i) => {
  const next = CALLING_IDS[(i + 1) % CALLING_IDS.length]!;
  const prev = CALLING_IDS[(i + CALLING_IDS.length - 1) % CALLING_IDS.length]!;
  edge(`w_${calling}_ring`, `w_${next}_ring`);
  edge(`w_${calling}_rn`, `w_${next}_ln`);
  // Doubled-web travel (P19): the innermost hexagon, the gate arcs, and
  // the outer rim linking crown regions in both directions.
  edge(`w_${calling}_spur`, `w_${next}_spur`);
  edge(`w_${calling}_ab`, `w_${next}_start`);
  edge(`w_${calling}_rim`, `w_${next}_crown`);
  edge(`w_${calling}_bl`, `w_${prev}_rim`);
});

/** Adjacency map, derived once from the edges. */
export const WEB_ADJACENCY: Record<string, string[]> = {};
for (const [a, b] of WEB_EDGES) {
  (WEB_ADJACENCY[a] ??= []).push(b);
  (WEB_ADJACENCY[b] ??= []).push(a);
}

export function webNode(id: string): WebNode | undefined {
  return WEB_NODES[id];
}
