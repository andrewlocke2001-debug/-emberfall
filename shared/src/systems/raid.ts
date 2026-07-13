import { RAID_BOSSES, RAID_LOCKOUT_MS } from "../data/raid";

/**
 * Raid progression logic (pure). The room feeds boss deaths in; this answers
 * "what spawns next?" and "may this character loot the relic?".
 */

/** The boss that spawns after `killedKind` dies (null = gauntlet complete). */
export function nextRaidBoss(killedKind: string): { kind: string; x: number; y: number } | null {
  const i = RAID_BOSSES.findIndex((b) => b.kind === killedKind);
  if (i < 0 || i === RAID_BOSSES.length - 1) return null;
  return RAID_BOSSES[i + 1]!;
}

/** Is this kill the final boss of the gauntlet? */
export function isFinalRaidBoss(kind: string): boolean {
  return RAID_BOSSES[RAID_BOSSES.length - 1]!.kind === kind;
}

/** Weekly lockout: relic-eligible only when the previous lock has expired. */
export function raidLocked(lockUntil: number, now: number): boolean {
  return now < lockUntil;
}

/** The new lock set when a relic is claimed. */
export function nextRaidLock(now: number): number {
  return now + RAID_LOCKOUT_MS;
}
