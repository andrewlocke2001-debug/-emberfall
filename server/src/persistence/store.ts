import { BASE_MAX_HP, type ItemStack } from "@mmo/shared";
import type { Equipment } from "@mmo/shared/systems/equipment";
import type { QuestLog } from "@mmo/shared/systems/quests";
import { restedAccrual } from "@mmo/shared/systems/progression";
import { prisma } from "./db";
import type { Prisma } from "../generated/prisma/client";

// why: Prisma's InputJsonValue rejects interface arrays / typed records (no
// index signature). The stored shapes are plain JSON, so these casts are sound.
const asJson = (
  v: ItemStack[] | Equipment | QuestLog | string[] | Record<string, number>,
): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue;

// Bank uses the same defensive parse as the bag (pg adapter can hand JSONB
// back as a string).

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
  miningXp: number;
  fishingXp: number;
  smithingXp: number;
  cookingXp: number;
  /** Banked rested-XP credit (accrued offline; +50% XP while it lasts). */
  restedXp: number;
  /** Inventory stacks (JSON column). Server is the sole writer. */
  inventory: ItemStack[];
  /** Equipped gear (slot → itemId JSON column). Server is the sole writer. */
  equipment: Equipment;
  /** Bank stacks (JSON column). Server is the sole writer. */
  bank: ItemStack[];
  /** Quest log (JSON column). Server is the sole writer. */
  quests: QuestLog;
  /** Friend display names (JSON column). Server is the sole writer. */
  friends: string[];
  /** Gear durability per item id (JSON column). Server is the sole writer. */
  durability: Record<string, number>;
  /** Guild membership at load time (written ONLY by persistence/guilds.ts —
   *  save() never touches it, so snapshots can't clobber a kick/promotion;
   *  optional because room snapshots don't carry it). */
  guildId?: string | null;
  guildRank?: string | null;
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

/** Coerce the JSON `quests` column into a clean quest log (defensive). */
function parseQuests(raw: unknown): QuestLog {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((q) => {
    if (q && typeof q === "object" && "questId" in q && "status" in q && "progress" in q) {
      const { questId, status, progress } = q as Record<string, unknown>;
      if (
        typeof questId === "string" &&
        (status === "active" || status === "complete") &&
        Array.isArray(progress) &&
        progress.every((n) => typeof n === "number")
      ) {
        return [{ questId, status, progress: progress as number[] }];
      }
    }
    return [];
  });
}

/** Coerce the JSON `durability` column into a clean { itemId: number } map. */
function parseDurability(raw: unknown): Record<string, number> {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(value as Record<string, unknown>)) {
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) out[id] = n;
  }
  return out;
}

/** Coerce a JSON string-array column (e.g. friends) defensively. */
function parseNames(raw: unknown): string[] {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter((n): n is string => typeof n === "string" && n.length > 0);
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
    // Read first (not upsert) so we can see the prior lastSeen — the @updatedAt
    // column is bumped by any write, so we must read it before updating.
    const existing = await prisma.player.findUnique({ where: { id: playerId } });
    if (existing) {
      // Bank rested credit for the time spent offline since the last save.
      const restedXp = restedAccrual(Date.now() - existing.lastSeen.getTime(), existing.restedXp);
      const row = await prisma.player.update({
        where: { id: playerId },
        // Rejoin: keep the latest name + the zone they're entering now.
        data: { name, zone, restedXp },
      });
      return toSavedCharacter(row);
    }
    const row = await prisma.player.create({
      data: {
        id: playerId,
        name,
        zone,
        x: spawn.x,
        y: spawn.y,
        hp: BASE_MAX_HP,
        maxHp: BASE_MAX_HP,
        level: 1,
        inventory: asJson([]),
        equipment: asJson({}),
        bank: asJson([]),
        quests: asJson([]),
        friends: asJson([]),
        durability: asJson({}),
      },
    });
    return toSavedCharacter(row);
  }

  /** Does a character with this display name exist? (friend-add validation) */
  async nameExists(name: string): Promise<boolean> {
    const row = await prisma.player.findFirst({ where: { name }, select: { id: true } });
    return row !== null;
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
      miningXp: c.miningXp,
      fishingXp: c.fishingXp,
      smithingXp: c.smithingXp,
      cookingXp: c.cookingXp,
      restedXp: c.restedXp,
      inventory: asJson(c.inventory),
      equipment: asJson(c.equipment),
      bank: asJson(c.bank),
      quests: asJson(c.quests),
      friends: asJson(c.friends),
      durability: asJson(c.durability),
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
  miningXp: number;
  fishingXp: number;
  smithingXp: number;
  cookingXp: number;
  restedXp: number;
  inventory: unknown;
  equipment: unknown;
  bank: unknown;
  quests: unknown;
  friends: unknown;
  durability: unknown;
  guildId: string | null;
  guildRank: string | null;
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
    miningXp: row.miningXp,
    fishingXp: row.fishingXp,
    smithingXp: row.smithingXp,
    cookingXp: row.cookingXp,
    restedXp: row.restedXp,
    inventory: parseInventory(row.inventory),
    equipment: parseEquipment(row.equipment),
    bank: parseInventory(row.bank),
    quests: parseQuests(row.quests),
    friends: parseNames(row.friends),
    durability: parseDurability(row.durability),
    guildId: row.guildId,
    guildRank: row.guildRank,
  };
}

/** Single shared store instance for the server process. */
export const characterStore = new CharacterStore();
