import { BASE_MAX_HP, type ItemStack } from "@mmo/shared";
import type { Equipment } from "@mmo/shared/systems/equipment";
import { prisma } from "./db";
import type { Prisma } from "../generated/prisma/client";

// why: Prisma's InputJsonValue rejects interface arrays / typed records (no
// index signature). The stored shapes are plain JSON, so these casts are sound.
const asJson = (v: ItemStack[] | Equipment): Prisma.InputJsonValue =>
  v as unknown as Prisma.InputJsonValue;

/** The persisted slice of a character — what survives reconnect/restart. */
export interface SavedCharacter {
  playerId: string;
  name: string;
  zone: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Melee level (= levelForXp(meleeXp)); persisted for convenience/queries. */
  level: number;
  meleeXp: number;
  vitalityXp: number;
  /** Inventory stacks (JSON column). Server is the sole writer. */
  inventory: ItemStack[];
  /** Equipped gear (slot → itemId JSON column). Server is the sole writer. */
  equipment: Equipment;
}

/** Coerce the JSON `inventory` column into well-formed stacks (defensive). */
function parseInventory(raw: unknown): ItemStack[] {
  // The pg driver adapter can hand JSONB back as a string rather than a parsed
  // value — normalize both shapes before validating.
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((s) => {
    if (s && typeof s === "object" && "itemId" in s && "qty" in s) {
      const itemId = (s as { itemId: unknown }).itemId;
      const qty = (s as { qty: unknown }).qty;
      if (typeof itemId === "string" && typeof qty === "number" && qty > 0) {
        return [{ itemId, qty }];
      }
    }
    return [];
  });
}

/** Coerce the JSON `equipment` column into a clean { slot: itemId } map. */
function parseEquipment(raw: unknown): Equipment {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Equipment = {};
  for (const [slot, id] of Object.entries(value as Record<string, unknown>)) {
    if (typeof id === "string" && id) out[slot as keyof Equipment] = id;
  }
  return out;
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
        meleeXp: 0,
        vitalityXp: 0,
        inventory: asJson([]),
        equipment: asJson({}),
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
      meleeXp: c.meleeXp,
      vitalityXp: c.vitalityXp,
      inventory: asJson(c.inventory),
      equipment: asJson(c.equipment),
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
  meleeXp: number;
  vitalityXp: number;
  inventory: unknown;
  equipment: unknown;
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
    meleeXp: row.meleeXp,
    vitalityXp: row.vitalityXp,
    inventory: parseInventory(row.inventory),
    equipment: parseEquipment(row.equipment),
  };
}

/** Single shared store instance for the server process. */
export const characterStore = new CharacterStore();
