/**
 * The Molten Throne (P12.1) — the 8-player raid. A linear five-boss gauntlet
 * in an instanced map: each kill spawns the next boss deeper in the hall, and
 * felling the Molten King awards the relic — once per character per week
 * (the lockout). Data-driven like everything else.
 */
export const RAID_ZONE = "molten_throne";

/** Kill order + arena positions (world px) inside molten_throne. */
export const RAID_BOSSES: { kind: string; x: number; y: number }[] = [
  { kind: "magmar_broodmother", x: 464, y: 1872 },
  { kind: "obsidian_colossus", x: 464, y: 1488 },
  { kind: "pyre_shade", x: 464, y: 1104 },
  { kind: "herald_of_cinders", x: 464, y: 720 },
  { kind: "molten_king", x: 464, y: 304 },
];

/** The lockout-gated final reward. */
export const RAID_RELIC = "molten_relic";

/** Weekly lockout: one relic per character per 7 days. */
export const RAID_LOCKOUT_MS = 7 * 24 * 60 * 60 * 1000;
