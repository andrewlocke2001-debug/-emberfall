/**
 * Hunts (P10.1) — Slayer-style kill tasks from the Huntmaster, the flagship
 * retention loop: take a task, cull the target, earn Hunt points, spend them
 * in the point shop. Data-driven (kit rule #4).
 */
export interface HuntTargetDef {
  /** Mob kind (see data/mobs). */
  mob: string;
  /** Kill count range, inclusive. */
  min: number;
  max: number;
  /** Hunt points awarded on completion. */
  points: number;
}

export const HUNT_TARGETS: HuntTargetDef[] = [
  { mob: "wolf", min: 4, max: 7, points: 10 },
  { mob: "emberling", min: 4, max: 7, points: 10 },
  { mob: "bandit", min: 3, max: 6, points: 14 },
  { mob: "thorn_stalker", min: 4, max: 7, points: 20 },
  { mob: "ruin_sentinel", min: 3, max: 5, points: 28 },
  { mob: "ember_wraith", min: 3, max: 5, points: 34 },
  { mob: "unreturned_wanderer", min: 3, max: 5, points: 24 },
  { mob: "quenchclaw", min: 4, max: 6, points: 30 },
  { mob: "scree_hound", min: 4, max: 6, points: 38 },
  { mob: "fen_creeper", min: 3, max: 5, points: 46 },
  { mob: "frost_wight", min: 3, max: 5, points: 56 },
  { mob: "court_sentinel", min: 3, max: 5, points: 66 },
  { mob: "cinder_husk", min: 3, max: 5, points: 76 },
];

/** The Hunt point shop: retention-loop rewards, priced in Hunt points. */
export const HUNT_REWARDS: { itemId: string; points: number }[] = [
  { itemId: "health_potion", points: 5 },
  { itemId: "iron_sword", points: 40 },
  { itemId: "copper_ring", points: 20 },
  { itemId: "iron_platebody", points: 90 },
  { itemId: "band_of_embers", points: 140 },
  { itemId: "ancient_relic", points: 60 },
  { itemId: "cinder_heart", points: 250 },
];

export function huntReward(itemId: string): { itemId: string; points: number } | undefined {
  return HUNT_REWARDS.find((r) => r.itemId === itemId);
}
