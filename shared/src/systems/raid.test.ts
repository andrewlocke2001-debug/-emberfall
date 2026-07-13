import { describe, it, expect } from "vitest";
import { nextRaidBoss, isFinalRaidBoss, raidLocked, nextRaidLock } from "./raid";
import { RAID_BOSSES, RAID_LOCKOUT_MS } from "../data/raid";
import { MOBS } from "../data/mobs";

describe("raid chain", () => {
  it("walks the gauntlet in order and ends after the king", () => {
    for (let i = 0; i < RAID_BOSSES.length - 1; i++) {
      expect(nextRaidBoss(RAID_BOSSES[i]!.kind)).toEqual(RAID_BOSSES[i + 1]);
    }
    expect(nextRaidBoss(RAID_BOSSES[RAID_BOSSES.length - 1]!.kind)).toBeNull();
    expect(nextRaidBoss("wolf")).toBeNull(); // non-raid kills don't chain
    expect(isFinalRaidBoss("molten_king")).toBe(true);
    expect(isFinalRaidBoss("magmar_broodmother")).toBe(false);
  });

  it("every raid boss is real data with a telegraph and no respawn", () => {
    for (const b of RAID_BOSSES) {
      const def = MOBS[b.kind];
      expect(def, b.kind).toBeDefined();
      expect(def!.boss).toBe(true);
      expect(def!.telegraph).toBeDefined();
      expect(def!.respawnMs).toBeGreaterThan(60 * 60_000); // never inside a run
    }
  });
});

describe("raid lockout", () => {
  it("locks for a week after a claim", () => {
    const now = 1_000_000;
    expect(raidLocked(0, now)).toBe(false);
    const lock = nextRaidLock(now);
    expect(lock).toBe(now + RAID_LOCKOUT_MS);
    expect(raidLocked(lock, now)).toBe(true);
    expect(raidLocked(lock, now + RAID_LOCKOUT_MS)).toBe(false);
  });
});
