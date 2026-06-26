import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import { BASE_MAX_HP, BASE_MAX_ENERGY } from "../types";

/**
 * Colyseus synced state for one zone.
 *
 * We use the functional `defineTypes()` API rather than `@type` decorators.
 * tsx/esbuild does not reliably apply `experimentalDecorators` (it transpiles
 * to TC39 standard decorators, which crash Colyseus's legacy `@type`). With
 * `declare`d fields + constructor initialization there is NO decorator
 * transform and NO emitted field code, so the prototype accessors that
 * `defineTypes` installs are never shadowed — identical behaviour under tsc,
 * tsx, Vite, and Vitest.
 *
 * These run on the SERVER. The Phaser client imports them as `import type` only,
 * decoding state from the schema reflection the server sends on join.
 */

/** A connected player's authoritative state. */
export class PlayerSchema extends Schema {
  /** Stable cross-session id (from join options) — survives reconnect. */
  declare id: string;
  declare name: string;
  declare x: number;
  declare y: number;
  declare hp: number;
  declare maxHp: number;
  declare energy: number;
  declare maxEnergy: number;
  /** Melee skill level (= levelForXp(meleeXp)) — drives combat stats. */
  declare level: number;
  /** Total Melee XP (drives attack/strength/defence via the skill curve). */
  declare meleeXp: number;
  /** Total Vitality XP (drives maxHp via the skill curve). */
  declare vitalityXp: number;
  /** Total Mining XP (P4 gathering skill). */
  declare miningXp: number;
  /** Total Fishing XP (P4 gathering skill). */
  declare fishingXp: number;
  /** Total Smithing XP (P4 crafting skill). */
  declare smithingXp: number;
  /** Total Cooking XP (P4 crafting skill). */
  declare cookingXp: number;
  /** Banked rested-XP credit (+50% XP while it lasts; accrues offline). */
  declare restedXp: number;
  declare alive: boolean;
  /** Server time (ms) of last ability use — drives cooldown enforcement. */
  declare lastAbilityAt: number;

  constructor() {
    super();
    this.id = "";
    this.name = "";
    this.x = 0;
    this.y = 0;
    this.hp = BASE_MAX_HP;
    this.maxHp = BASE_MAX_HP;
    this.energy = BASE_MAX_ENERGY;
    this.maxEnergy = BASE_MAX_ENERGY;
    this.level = 1;
    this.meleeXp = 0;
    this.vitalityXp = 0;
    this.miningXp = 0;
    this.fishingXp = 0;
    this.smithingXp = 0;
    this.cookingXp = 0;
    this.restedXp = 0;
    this.alive = true;
    this.lastAbilityAt = 0;
  }
}
defineTypes(PlayerSchema, {
  id: "string",
  name: "string",
  x: "number",
  y: "number",
  hp: "number",
  maxHp: "number",
  energy: "number",
  maxEnergy: "number",
  level: "number",
  meleeXp: "number",
  vitalityXp: "number",
  miningXp: "number",
  fishingXp: "number",
  smithingXp: "number",
  cookingXp: "number",
  restedXp: "number",
  alive: "boolean",
  lastAbilityAt: "number",
});

/** A non-player combatant. M0 ships one stationary training dummy. */
export class EnemySchema extends Schema {
  declare id: string;
  /** Mob family key (see @mmo/shared/data/mobs) — drives stats + render tint. */
  declare kind: string;
  declare name: string;
  declare x: number;
  declare y: number;
  declare hp: number;
  declare maxHp: number;
  declare alive: boolean;
  /** Server time (ms) at which a dead enemy respawns (0 = not pending). */
  declare respawnAt: number;

  constructor() {
    super();
    this.id = "";
    this.kind = "dummy";
    this.name = "Training Dummy";
    this.x = 0;
    this.y = 0;
    this.hp = 200;
    this.maxHp = 200;
    this.alive = true;
    this.respawnAt = 0;
  }
}
defineTypes(EnemySchema, {
  id: "string",
  kind: "string",
  name: "string",
  x: "number",
  y: "number",
  hp: "number",
  maxHp: "number",
  alive: "boolean",
  respawnAt: "number",
});

/** A pile of items lying on the ground (dropped loot). */
export class GroundLootSchema extends Schema {
  declare id: string;
  declare itemId: string;
  declare qty: number;
  declare x: number;
  declare y: number;
  /** Account id reserved to pick this up until `ownerUntil` (""=public). */
  declare ownerId: string;
  /** Server time (ms) after which anyone may pick it up. */
  declare ownerUntil: number;

  constructor() {
    super();
    this.id = "";
    this.itemId = "";
    this.qty = 0;
    this.x = 0;
    this.y = 0;
    this.ownerId = "";
    this.ownerUntil = 0;
  }
}
defineTypes(GroundLootSchema, {
  id: "string",
  itemId: "string",
  qty: "number",
  x: "number",
  y: "number",
  ownerId: "string",
  ownerUntil: "number",
});

/** Root room state for a single zone. */
export class ZoneState extends Schema {
  declare zoneId: string;
  declare players: MapSchema<PlayerSchema>;
  declare enemies: MapSchema<EnemySchema>;
  declare loot: MapSchema<GroundLootSchema>;

  constructor() {
    super();
    this.zoneId = "verdant-vale";
    this.players = new MapSchema<PlayerSchema>();
    this.enemies = new MapSchema<EnemySchema>();
    this.loot = new MapSchema<GroundLootSchema>();
  }
}
defineTypes(ZoneState, {
  zoneId: "string",
  players: { map: PlayerSchema },
  enemies: { map: EnemySchema },
  loot: { map: GroundLootSchema },
});
