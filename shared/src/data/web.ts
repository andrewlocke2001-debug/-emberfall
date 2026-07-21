import type { CallingId, TalentEffects } from "./callings";
import { CALLING_IDS } from "./callings";

/**
 * The Passive Web (P15.2) — one shared allocation graph in the spirit of
 * Path of Exile's tree, replacing the six siloed Calling trees. Your Calling
 * decides WHERE you start on the wheel; from there you allocate any node
 * ADJACENT to one you already own. Three travel layers let builds cross
 * class territory: the center ring (short, expensive detours), the six
 * spokes, and the outer rim linking neighboring keystone regions.
 *
 * The graph is BUILT here (data-as-code, like the map painters): six 60°
 * sectors, each with an inward path to the center ring, an outward spine to
 * a keystone, and two flavored branches with a notable at each tip. All
 * nodes are rank 1 (PoE-style): the build is the SHAPE of your allocation.
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

/** Per-sector flavor: [smallA, smallB, notableL, notableR, keystone]. */
const FLAVOR: Record<
  CallingId,
  {
    smalls: { name: string; effects: TalentEffects }[];
    notableL: { name: string; effects: TalentEffects };
    notableR: { name: string; effects: TalentEffects };
    keystone: { name: string; desc: string; effects: TalentEffects };
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
});

// Ring travel: the center hexagon, and the rim links between sectors
// (sector i's RIGHT notable meets sector i+1's LEFT notable).
CALLING_IDS.forEach((calling, i) => {
  const next = CALLING_IDS[(i + 1) % CALLING_IDS.length]!;
  edge(`w_${calling}_ring`, `w_${next}_ring`);
  edge(`w_${calling}_rn`, `w_${next}_ln`);
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
