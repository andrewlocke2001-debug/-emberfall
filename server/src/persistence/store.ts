import { BASE_MAX_HP } from "@mmo/shared";
import { prisma } from "./db";

/** The persisted slice of a character — what survives reconnect/restart. */
export interface SavedCharacter {
  playerId: string;
  name: string;
  zone: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
}

/**
 * Prisma-backed character persistence (replaced the M0 JSON snapshot store).
 * Same interface, now async: load on join, write-through on leave + periodic
 * snapshot. SQLite locally, Postgres in production (see design/DEPLOY.md).
 */
class CharacterStore {
  /** Load an existing character, or create a fresh one at the spawn point. */
  async loadOrCreate(
    playerId: string,
    name: string,
    zone: string,
    spawn: { x: number; y: number },
  ): Promise<SavedCharacter> {
    const row = await prisma.player.upsert({
      where: { id: playerId },
      // Rejoin: keep the latest name + the zone they're entering now.
      update: { name, zone },
      create: {
        id: playerId,
        name,
        zone,
        x: spawn.x,
        y: spawn.y,
        hp: BASE_MAX_HP,
        maxHp: BASE_MAX_HP,
        level: 1,
      },
    });
    return toSavedCharacter(row);
  }

  /** Snapshot a character's current state. Upsert: defensive against wipes. */
  async save(c: SavedCharacter): Promise<void> {
    const data = {
      name: c.name,
      zone: c.zone,
      x: c.x,
      y: c.y,
      hp: c.hp,
      maxHp: c.maxHp,
      level: c.level,
    };
    await prisma.player.upsert({
      where: { id: c.playerId },
      update: data,
      create: { id: c.playerId, ...data },
    });
  }
}

function toSavedCharacter(row: {
  id: string;
  name: string;
  zone: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
}): SavedCharacter {
  return {
    playerId: row.id,
    name: row.name,
    zone: row.zone,
    x: row.x,
    y: row.y,
    hp: row.hp,
    maxHp: row.maxHp,
    level: row.level,
  };
}

/** Single shared store instance for the server process. */
export const characterStore = new CharacterStore();
