/**
 * Single-player engine — runs the game entirely in the browser, no server.
 *
 * It mirrors the server's ZoneRoom against the SAME shared systems + schema, so
 * behaviour matches multiplayer; it just drops everything multiplayer (other
 * players, DB, auth, cross-zone rooms, social) and persists one character to
 * localStorage. It presents the exact surface ZoneScene consumes from a Colyseus
 * room (`state`, `send`, `onMessage`, `sessionId`, `roomId`, `leave`) plus a `$`
 * that replays/streams players/enemies/loot add-remove — the client reads live
 * schema fields each tick, so mutating the same ZoneState in place is enough.
 *
 * When real multiplayer returns, the server ZoneRoom is the source of truth and
 * this file simply isn't used (SOLO=false).
 */
import {
  ABILITIES,
  ClientMessage,
  ServerMessage,
  MOVE_SPEED,
  MOUNT_SPEED_MULT,
  MOUNT_COST,
  FAST_TRAVEL_COST,
  DEATH_DURABILITY_LOSS,
  TICK_MS,
  GCD_MS,
  PLAYER_ACCURACY_BONUS,
  BG_ZONE,
  SKILL_IDS,
  LEVEL_CAP,
  ENERGY_REGEN_PER_SEC,
  PICKUP_RANGE,
  LOOT_OWNERSHIP_MS,
  LOOT_DESPAWN_MS,
  GATHER_RANGE,
  TALK_RANGE,
  distSq,
  type SkillId,
  type CombatSkill,
  type WeaponType,
} from "@mmo/shared";
import type { MapSchema } from "@colyseus/schema";
import { ZoneState, PlayerSchema, EnemySchema, GroundLootSchema } from "@mmo/shared/schema/state";
import type { EquipSlot } from "@mmo/shared/data/items";
import { addItem, removeItem, countItem, canAdd, type Inventory } from "@mmo/shared/systems/inventory";
import { craft } from "@mmo/shared/systems/crafting";
import { buyCost, sellValue } from "@mmo/shared/systems/shop";
import {
  acceptQuest,
  canAccept,
  recordKill,
  recordTalk,
  questReady,
  completeQuest,
  findQuest,
  type QuestLog,
} from "@mmo/shared/systems/quests";
import { equip, unequip, equipmentBonus, type Equipment } from "@mmo/shared/systems/equipment";
import {
  hasDurability,
  wear,
  isBroken,
  repairCost,
  currentDurability,
  effectiveEquipment,
  type Durability,
} from "@mmo/shared/systems/durability";
import { deposit, withdraw, type Bank } from "@mmo/shared/systems/bank";
import { itemDef } from "@mmo/shared/data/items";
import { nearBank } from "@mmo/shared/data/banks";
import { resourceNode } from "@mmo/shared/data/resources";
import { recipeDef } from "@mmo/shared/data/recipes";
import { questDef } from "@mmo/shared/data/quests";
import { npcDef } from "@mmo/shared/data/npcs";
import { waystoneById, waystonesInZone } from "@mmo/shared/data/waystones";
import { RAID_ZONE, RAID_BOSSES, RAID_RELIC } from "@mmo/shared/data/raid";
import { nextRaidBoss, isFinalRaidBoss, raidLocked, nextRaidLock } from "@mmo/shared/systems/raid";
import {
  INVASION_INTERVAL_MS,
  INVASION_ESCORTS,
  INVASION_HERALD,
  INVASION_ESCORT_KIND,
  INVASION_ZONES,
  INVASION_HERALD_ID,
  INVASION_ESCORT_PREFIX,
} from "@mmo/shared/data/invasions";
import { vendorDef, vendorsInZone } from "@mmo/shared/data/vendors";
import { rollDrops } from "@mmo/shared/systems/loot";
import { stepWithCollision, isBoxFree } from "@mmo/shared/systems/collision";
import { resolveAttack, type CombatStats } from "@mmo/shared/systems/combatmath";
import {
  combatStatsFromLevel,
  gainXp,
  levelForXp,
  xpForLevel,
  maxHpForVitality,
  restedBonus,
  restedAccrual,
} from "@mmo/shared/systems/progression";
import { mapForId, isDungeonId, DEFAULT_ZONE } from "@mmo/shared/data/zones";
import { mobDef, type TelegraphDef } from "@mmo/shared/data/mobs";
import { exitAt, type ZoneMap } from "@mmo/shared/systems/zonemap";
import { parseCommand } from "@mmo/shared/systems/gm";
import { rollHunt, recordHuntKill, type HuntTask } from "@mmo/shared/systems/hunts";
import { RESPEC_COST } from "@mmo/shared/data/perks";
import { CALLING_IDS, CALLING_RESPEC_COST, type CallingId } from "@mmo/shared/data/callings";
import {
  talentPointsFor,
  canSpendTalent,
  applyTalentStats,
  talentMaxHpBonus,
  talentGcdMs,
  talentLifesteal,
  talentExecuteAdjust,
  talentCritChance,
  talentEnergyCostMul,
  talentHealMul,
  CRIT_MULT,
  type Talents,
} from "@mmo/shared/systems/callings";
import { governingSkill, canUseWithWeapon } from "@mmo/shared/systems/weapons";
import { applyEffect, tickEffects, moveMultOf, type ActiveEffect } from "@mmo/shared/systems/effects";
import {
  canChoosePerk,
  applyPerkStats,
  perkGcdMs,
  perkLifesteal,
  perkMaxHpBonus,
  executeAdjust,
} from "@mmo/shared/systems/perks";
import { huntReward } from "@mmo/shared/data/hunts";

// Mirrors of ZoneRoom's local tuning constants.
const PLAYER_HALF = 12;
const ENEMY_HALF = 12;
const PLAYER_RESPAWN_MS = 5000;
const VITALITY_XP_FRACTION = 1 / 3;
const SOLO_ID = "local";
const SAVE_KEY = "mmo:solo:v1";
const SAVE_INTERVAL_MS = 5000;

type NonCombatSkill = "mining" | "fishing" | "smithing" | "cooking";

/** The single persisted solo character (localStorage). */
export interface SoloSave {
  name: string;
  zone: string;
  x: number;
  y: number;
  hp: number;
  meleeXp: number;
  rangedXp: number;
  magicXp: number;
  vitalityXp: number;
  miningXp: number;
  fishingXp: number;
  smithingXp: number;
  cookingXp: number;
  restedXp: number;
  inventory: Inventory;
  equipment: Equipment;
  durability: Durability;
  bank: Bank;
  quests: QuestLog;
  hunt: HuntTask | null;
  huntPoints: number;
  hasMount: boolean;
  raidLockUntil: number;
  perks: string[];
  calling: string;
  talents: Record<string, number>;
  lastSeen: number;
}

function defaultSave(): SoloSave {
  return {
    name: localStorage.getItem("mmo:name")?.trim() || "Wanderer",
    zone: DEFAULT_ZONE,
    x: 0,
    y: 0,
    hp: 100,
    meleeXp: 0,
    rangedXp: 0,
    magicXp: 0,
    vitalityXp: 0,
    miningXp: 0,
    fishingXp: 0,
    smithingXp: 0,
    cookingXp: 0,
    restedXp: 0,
    inventory: [],
    equipment: {},
    durability: {},
    bank: [],
    quests: [],
    hunt: null,
    huntPoints: 0,
    hasMount: false,
    raidLockUntil: 0,
    perks: [],
    calling: "",
    talents: {},
    lastSeen: Date.now(),
  };
}

export function loadSoloSave(): SoloSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return { ...defaultSave(), ...(JSON.parse(raw) as Partial<SoloSave>) };
  } catch {
    return defaultSave();
  }
}

type Listener = (entity: unknown, key: string) => void;

/**
 * A browser-side stand-in for a Colyseus Room, driving the same ZoneState the
 * renderer reads. One per zone; travel disposes it and builds the next.
 */
export class SoloRoom {
  readonly sessionId = SOLO_ID;
  readonly roomId: string;
  readonly state = new ZoneState();
  private readonly map: ZoneMap;

  private readonly handlers = new Map<string, (payload: unknown) => void>();
  private readonly addCbs: Record<string, Listener[]> = { players: [], enemies: [], loot: [] };
  private readonly removeCbs: Record<string, Listener[]> = { players: [], enemies: [], loot: [] };

  private readonly input = { dx: 0, dy: 0 };
  private readonly enemyAI = new Map<
    string,
    { homeX: number; homeY: number; target: string | null; lastAttackAt: number; teleReadyAt: number }
  >();
  private readonly tagged = new Set<string>(); // enemy ids this player has hit this life
  /** Status effects (bleed/burn/slow) per enemy id (P13.2). */
  private readonly activeEffects = new Map<string, ActiveEffect[]>();
  /** Per-boss fight state (P15.1): fired add-waves, blink + volley timers. */
  private readonly bossState = new Map<string, { firedAdds: Set<number>; lastBlinkAt: number; volleyLeft: number }>();
  /** Adds queued during the enemies pass (spawning mid-iteration is unsafe). */
  private pendingAdds: { kind: string; x: number; y: number; id: string }[] = [];
  private addSeq = 0;
  private readonly lootDespawn = new Map<string, number>();
  private gatherState: { nodeId: string; finishAt: number } | null = null;
  private deadUntil = 0;
  private gcdUntil = 0;
  private readonly abilityCooldowns = new Map<string, number>();
  private lootSeq = 0;
  private loop: ReturnType<typeof setInterval> | undefined;
  private saveTimer: ReturnType<typeof setInterval> | undefined;
  private transferring = false;
  private readonly onUnload = (): void => this.persist();

  private inventory: Inventory;
  private equipment: Equipment;
  private durability: Durability;
  private bank: Bank;
  private questLog: QuestLog;
  private hunt: HuntTask | null;
  private huntPts: number;
  private hasMount: boolean;
  private raidLock: number;
  private chosenPerks: string[];
  private calling: CallingId | "";
  private talents: Talents;
  private invasionActive = false;
  private nextInvasionAt = Date.now() + INVASION_INTERVAL_MS;

  constructor(
    zoneId: string,
    entry: string | undefined,
    private save: SoloSave,
  ) {
    this.map = mapForId(zoneId) ?? mapForId(DEFAULT_ZONE)!;
    this.roomId = `solo-${this.map.id}`;
    this.inventory = save.inventory;
    this.equipment = save.equipment;
    this.durability = save.durability;
    this.bank = save.bank;
    this.questLog = save.quests;
    this.hunt = save.hunt;
    this.huntPts = save.huntPoints;
    this.hasMount = save.hasMount ?? false;
    this.raidLock = save.raidLockUntil ?? 0;
    this.chosenPerks = save.perks ?? [];
    this.calling = (CALLING_IDS as readonly string[]).includes(save.calling) ? (save.calling as CallingId) : "";
    this.talents = save.talents ?? {};

    // Offline rested-XP accrual (mirrors the server's load path).
    save.restedXp = restedAccrual(Date.now() - save.lastSeen, save.restedXp);

    this.state.zoneId = this.map.id;
    this.buildPlayer(entry);
    this.spawnEnemies();

    this.loop = setInterval(() => this.update(TICK_MS), TICK_MS);
    this.saveTimer = setInterval(() => this.persist(), SAVE_INTERVAL_MS);
    window.addEventListener("pagehide", this.onUnload);
    window.addEventListener("beforeunload", this.onUnload);
  }

  // --- Colyseus-room surface the client consumes -----------------------------

  onMessage(type: string, cb: (payload: unknown) => void): void {
    this.handlers.set(type, cb);
  }

  send(type: string, payload?: unknown): void {
    this.dispatch(type, payload ?? {});
  }

  async leave(): Promise<void> {
    if (this.loop) clearInterval(this.loop);
    if (this.saveTimer) clearInterval(this.saveTimer);
    window.removeEventListener("pagehide", this.onUnload);
    window.removeEventListener("beforeunload", this.onUnload);
    this.persist();
  }

  /** The getStateCallbacks stand-in: `$(state).players.onAdd(cb)` etc. */
  callbacks(): (instance: unknown) => Record<string, { onAdd: (cb: Listener) => void; onRemove: (cb: Listener) => void }> {
    const bind = <T>(coll: MapSchema<T>, adds: Listener[], removes: Listener[]) => ({
      onAdd: (cb: Listener) => {
        coll.forEach((v, k) => cb(v as unknown, k)); // replay current entries (Colyseus does this)
        adds.push(cb);
      },
      onRemove: (cb: Listener) => {
        removes.push(cb);
      },
    });
    return () => ({
      players: bind(this.state.players, this.addCbs["players"]!, this.removeCbs["players"]!),
      enemies: bind(this.state.enemies, this.addCbs["enemies"]!, this.removeCbs["enemies"]!),
      loot: bind(this.state.loot, this.addCbs["loot"]!, this.removeCbs["loot"]!),
    });
  }

  // --- setup -----------------------------------------------------------------

  private buildPlayer(entry: string | undefined): void {
    const def = this.map.entries["default"]!;
    const named = entry ? this.map.entries[entry] : undefined;
    let x: number;
    let y: number;
    if (named) {
      x = named.x;
      y = named.y;
    } else if (
      this.save.zone === this.map.id &&
      isBoxFree(this.map.collision, this.save.x, this.save.y, PLAYER_HALF)
    ) {
      x = this.save.x;
      y = this.save.y;
    } else {
      x = def.x;
      y = def.y;
    }

    const p = new PlayerSchema();
    p.id = SOLO_ID;
    p.name = this.save.name;
    p.x = x;
    p.y = y;
    p.meleeXp = this.save.meleeXp;
    p.rangedXp = this.save.rangedXp;
    p.magicXp = this.save.magicXp;
    p.vitalityXp = this.save.vitalityXp;
    p.miningXp = this.save.miningXp;
    p.fishingXp = this.save.fishingXp;
    p.smithingXp = this.save.smithingXp;
    p.cookingXp = this.save.cookingXp;
    p.restedXp = this.save.restedXp;
    p.level = levelForXp(this.save.meleeXp);
    p.maxHp = maxHpForVitality(levelForXp(this.save.vitalityXp)) + equipmentBonus(this.effectiveGear(), itemDef).maxHp;
    p.hp = Math.min(this.save.hp > 0 ? this.save.hp : p.maxHp, p.maxHp);
    p.alive = p.hp > 0;
    this.state.players.set(SOLO_ID, p);
  }

  private spawnEnemies(): void {
    this.map.enemies.forEach((marker, i) => {
      this.addEnemy(marker.kind, marker.x, marker.y, `${mobDef(marker.kind).kind}-${i + 1}`);
    });
    // The raid chain-spawns (mirrors the server): only the first boss waits.
    if (this.map.id === RAID_ZONE) {
      const first = RAID_BOSSES[0]!;
      this.addEnemy(first.kind, first.x, first.y, `raid-${first.kind}`);
    }
  }

  private addEnemy(kind: string, x: number, y: number, id: string): EnemySchema {
    const def = mobDef(kind);
    const e = new EnemySchema();
    e.id = id;
    e.kind = def.kind;
    e.name = def.name;
    e.x = x;
    e.y = y;
    e.hp = def.maxHp;
    e.maxHp = def.maxHp;
    e.alive = true;
    this.state.enemies.set(id, e);
    this.enemyAI.set(id, { homeX: x, homeY: y, target: null, lastAttackAt: 0, teleReadyAt: 0 });
    this.fire("enemies", "add", e, id);
    return e;
  }

  // --- lifecycle callback plumbing -------------------------------------------

  private fire(key: string, kind: "add" | "remove", entity: unknown, id: string): void {
    const cbs = kind === "add" ? this.addCbs[key]! : this.removeCbs[key]!;
    for (const cb of cbs) cb(entity, id);
  }

  private emit(type: string, payload: unknown): void {
    this.handlers.get(type)?.(payload);
  }

  private system(text: string): void {
    this.emit(ServerMessage.Chat, {
      channel: "zone",
      from: "System",
      zone: this.map.id,
      text,
      at: Date.now(),
    });
  }

  // --- message dispatch (mirrors ZoneRoom's handlers, single-client) ---------

  private dispatch(type: string, msg: any): void {
    switch (type) {
      case ClientMessage.Move:
        this.input.dx = msg.dx;
        this.input.dy = msg.dy;
        break;
      case ClientMessage.UseAbility:
        this.useAbility(msg);
        break;
      case ClientMessage.RequestInventory:
        this.pushInventory();
        this.pushEquipment();
        this.pushQuests();
        this.pushHunt();
        this.pushMount();
        this.pushPerks();
        this.pushCalling();
        this.pushEmptySocial();
        break;
      case ClientMessage.Equip:
        this.doEquip(msg.itemId);
        break;
      case ClientMessage.Unequip:
        this.doUnequip(msg.slot);
        break;
      case ClientMessage.Consume:
        this.doConsume(msg.itemId);
        break;
      case ClientMessage.Repair:
        this.doRepair();
        break;
      case ClientMessage.TradeRequest:
        // Single-player: no other players to trade with.
        this.system("There's no one else here to trade with.");
        break;
      case ClientMessage.DuelRequest:
        this.system("There's no one else here to duel.");
        break;
      case ClientMessage.HuntAssign:
        this.doHuntAssign();
        break;
      case ClientMessage.HuntBuy:
        this.doHuntBuy(msg.itemId);
        break;
      case ClientMessage.RequestHunt:
        this.pushHunt();
        break;
      case ClientMessage.BuyMount:
        this.doBuyMount();
        break;
      case ClientMessage.ToggleMount:
        this.doToggleMount();
        break;
      case ClientMessage.RequestMount:
        this.pushMount();
        break;
      case ClientMessage.FastTravel:
        this.doFastTravel(msg.to);
        break;
      case ClientMessage.BgQueue:
        this.system("The battleground needs other players — it opens with multiplayer.");
        break;
      case ClientMessage.ChoosePerk:
        this.doChoosePerk(msg.id);
        break;
      case ClientMessage.RespecPerks:
        this.doRespecPerks();
        break;
      case ClientMessage.RequestPerks:
        this.pushPerks();
        break;
      case ClientMessage.ChooseCalling:
        this.doChooseCalling(msg.id);
        break;
      case ClientMessage.SpendTalent:
        this.doSpendTalent(msg.id);
        break;
      case ClientMessage.RespecCalling:
        this.doRespecCalling();
        break;
      case ClientMessage.RequestCalling:
        this.pushCalling();
        break;
      case ClientMessage.ExchangePost:
        // Single-player: no market without other players.
        this.system("The Exchange only trades between real players — it opens with multiplayer.");
        break;
      case ClientMessage.Pickup:
        this.doPickup(msg.lootId);
        break;
      case ClientMessage.RequestBank:
        this.pushBank();
        break;
      case ClientMessage.Deposit:
        this.doBankMove(msg.itemId, msg.qty, "deposit");
        break;
      case ClientMessage.Withdraw:
        this.doBankMove(msg.itemId, msg.qty, "withdraw");
        break;
      case ClientMessage.Gather:
        this.doGather(msg.nodeId);
        break;
      case ClientMessage.Craft:
        this.doCraft(msg.recipeId);
        break;
      case ClientMessage.QuestAccept:
        this.doQuestAccept(msg.questId);
        break;
      case ClientMessage.QuestComplete:
        this.doQuestComplete(msg.questId);
        break;
      case ClientMessage.Talk:
        this.doTalk(msg.npcId);
        break;
      case ClientMessage.Buy:
        this.doTrade(msg, "buy");
        break;
      case ClientMessage.Sell:
        this.doTrade(msg, "sell");
        break;
      case ClientMessage.Chat:
        this.doChat(msg);
        break;
      case ClientMessage.RequestFriends:
      case ClientMessage.RequestParty:
      case ClientMessage.RequestGuild:
        this.pushEmptySocial();
        break;
      // Whisper / friend / party / guild mutations are inert in single-player.
      default:
        break;
    }
  }

  private player(): PlayerSchema {
    return this.state.players.get(SOLO_ID)!;
  }

  // --- combat + abilities ----------------------------------------------------

  /** Equipment that currently grants bonuses (broken gear excluded). */
  private effectiveGear(): Equipment {
    return effectiveEquipment(this.equipment, this.durability, itemDef);
  }

  private playerStats(): CombatStats {
    const p = this.player();
    const skill = governingSkill(this.equippedWeaponType());
    const level =
      skill === "ranged" ? levelForXp(p.rangedXp) : skill === "magic" ? levelForXp(p.magicXp) : p.level;
    const base = combatStatsFromLevel(level, p.hp, p.maxHp);
    base.defence = combatStatsFromLevel(p.level, p.hp, p.maxHp).defence;
    const bonus = equipmentBonus(this.effectiveGear(), itemDef);
    base.attack += bonus.attack;
    base.strength += bonus.strength;
    base.defence += bonus.defence;
    return applyTalentStats(applyPerkStats(base, this.chosenPerks), this.talents);
  }

  /** The weapon class in hand (undefined = bare fists or a broken weapon). */
  private equippedWeaponType(): WeaponType | undefined {
    const weaponId = this.effectiveGear().weapon;
    return weaponId ? itemDef(weaponId)?.weaponType : undefined;
  }

  private mobStats(e: EnemySchema): CombatStats {
    const d = mobDef(e.kind);
    return { attack: d.attack, strength: d.strength, defence: d.defence, hp: e.hp, maxHp: e.maxHp, alive: e.alive };
  }

  private useAbility(msg: { abilityId: string; targetId: string }): void {
    const p = this.player();
    if (!p.alive) return;
    const ability = ABILITIES[msg.abilityId as keyof typeof ABILITIES];
    if (!ability) return;
    // Weapon gating (P13): kits belong to weapon classes — a bow cannot Strike.
    if (!canUseWithWeapon(ability, this.equippedWeaponType())) {
      return this.system(ability.name + " needs a different weapon in hand.");
    }

    if (p.mounted) p.mounted = false; // you fight on foot

    const now = Date.now();
    const onGcd = ability.onGcd ?? true;
    if (onGcd && now < this.gcdUntil) return;
    if (now < (this.abilityCooldowns.get(ability.id) ?? 0)) return;
    const cost = Math.round((ability.energyCost ?? 0) * talentEnergyCostMul(this.talents));
    if (p.energy < cost) return;

    if (ability.kind === "heal") {
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + Math.round((ability.heal ?? 0) * talentHealMul(this.talents)));
      this.commitAbility(ability, now);
      p.energy -= cost;
      const restored = p.hp - before;
      if (restored > 0) {
        this.emit(ServerMessage.CombatEvent, { attackerId: SOLO_ID, targetId: SOLO_ID, damage: restored, targetDied: false, heal: true });
      }
      return;
    }

    const enemy = this.state.enemies.get(msg.targetId);
    if (!enemy || !enemy.alive) return;
    if (distSq(p.x, p.y, enemy.x, enemy.y) > ability.range * ability.range) return;

    const atk = this.playerStats();
    atk.strength = Math.round(atk.strength * (ability.strengthMul ?? 1));
    const result = resolveAttack(atk, this.mobStats(enemy), Math.random, PLAYER_ACCURACY_BONUS);
    this.commitAbility(ability, now);
    p.energy -= cost;

    if (!result.hit) {
      this.emit(ServerMessage.CombatEvent, { attackerId: SOLO_ID, targetId: enemy.id, damage: 0, targetDied: false, miss: true });
    }
    if (result.hit) {
      let dmg = executeAdjust(result.damage, enemy.hp, enemy.maxHp, this.chosenPerks);
      dmg = talentExecuteAdjust(dmg, enemy.hp, enemy.maxHp, this.talents);
      if (dmg > 0 && Math.random() < talentCritChance(this.talents)) dmg = Math.round(dmg * CRIT_MULT);
      const hpAfter = Math.max(0, enemy.hp - dmg);
      const died = hpAfter <= 0;
      enemy.hp = hpAfter;
      const ls = perkLifesteal(this.chosenPerks) + talentLifesteal(this.talents);
      if (ls > 0 && dmg > 0 && p.alive) p.hp = Math.min(p.maxHp, p.hp + ls);
      this.wearGear(this.equipment.weapon); // a landing swing wears the weapon
      this.tagged.add(enemy.id);
      if (ability.effect && !died) {
        this.activeEffects.set(
          enemy.id,
          applyEffect(this.activeEffects.get(enemy.id) ?? [], ability.effect, SOLO_ID, ability.skill ?? "melee", now),
        );
      }
      this.emit(ServerMessage.CombatEvent, { attackerId: SOLO_ID, targetId: enemy.id, damage: dmg, targetDied: died });
      if (died) this.killEnemy(enemy, now, ability.skill ?? "melee");
    }
  }

  private commitAbility(ability: { id: string; cooldownMs: number; onGcd?: boolean }, now: number): void {
    if (ability.onGcd ?? true) this.gcdUntil = now + talentGcdMs(this.talents, perkGcdMs(this.chosenPerks, GCD_MS));
    if (ability.cooldownMs > 0) this.abilityCooldowns.set(ability.id, now + ability.cooldownMs);
  }

  /** A mob dies: stop it, clear its effects, schedule respawn, pay credit. */
  private killEnemy(enemy: EnemySchema, now: number, skill: CombatSkill): void {
    enemy.alive = false;
    enemy.respawnAt = now + mobDef(enemy.kind).respawnMs;
    enemy.teleAt = 0;
    enemy.teleRadius = 0;
    this.activeEffects.delete(enemy.id);
    this.bossState.delete(enemy.id);
    this.awardKill(enemy, skill);
    if (enemy.id.startsWith("add-")) {
      const id = enemy.id;
      this.state.enemies.delete(id);
      this.enemyAI.delete(id);
      this.fire("enemies", "remove", undefined, id);
    }
  }

  private awardKill(enemy: EnemySchema, skill: CombatSkill = "melee"): void {
    if (!this.tagged.has(enemy.id)) return;
    this.tagged.delete(enemy.id);
    const def = mobDef(enemy.kind);
    const now = Date.now();
    this.grantXp(def.xpReward, Math.floor(def.xpReward * VITALITY_XP_FRACTION), skill);
    for (const stack of rollDrops(def.drops)) {
      this.spawnLoot(stack.itemId, stack.qty, enemy.x, enemy.y, now);
    }
    const next = recordKill(this.questLog, enemy.kind, questDef);
    if (next !== this.questLog) {
      this.questLog = next;
      this.pushQuests();
    }
    const hunt = recordHuntKill(this.hunt, enemy.kind);
    if (hunt.task !== this.hunt || hunt.earned > 0) {
      this.hunt = hunt.task;
      if (hunt.earned > 0) {
        this.huntPts += hunt.earned;
        this.system(`Hunt complete! +${hunt.earned} Hunt points.`);
      }
      this.pushHunt();
    }

    // World event: felling the herald repels the invasion (P12.3).
    if (enemy.id === INVASION_HERALD_ID) this.endInvasion();

    // The raid gauntlet (mirrors the server's advanceRaid).
    if (this.map.id === RAID_ZONE) {
      const next = nextRaidBoss(enemy.kind);
      if (next) {
        this.addEnemy(next.kind, next.x, next.y, `raid-${next.kind}`);
        this.system(`${mobDef(next.kind).name} stirs deeper in the Throne…`);
      } else if (isFinalRaidBoss(enemy.kind)) {
        if (raidLocked(this.raidLock, now)) {
          this.system("You already claimed your relic this week (weekly lockout).");
        } else {
          const relic = itemDef(RAID_RELIC)!;
          const res = addItem(this.inventory, relic.id, 1, relic.maxStack);
          if (res.added <= 0) {
            this.spawnLoot(relic.id, 1, enemy.x, enemy.y, now);
          } else {
            this.inventory = res.inventory;
            this.pushInventory();
          }
          this.raidLock = nextRaidLock(now);
          this.system(`The ${relic.name} is yours! (Locked out for a week.)`);
        }
        this.system("The Molten Throne is broken. Long live the throne-breaker!");
      }
    }
  }

  private spawnLoot(itemId: string, qty: number, x: number, y: number, now: number): void {
    const loot = new GroundLootSchema();
    loot.id = `loot-${++this.lootSeq}`;
    loot.itemId = itemId;
    loot.qty = qty;
    loot.x = x + (Math.random() * 32 - 16);
    loot.y = y + (Math.random() * 32 - 16);
    loot.ownerId = SOLO_ID;
    loot.ownerUntil = now + LOOT_OWNERSHIP_MS;
    this.state.loot.set(loot.id, loot);
    this.lootDespawn.set(loot.id, now + LOOT_DESPAWN_MS);
    this.fire("loot", "add", loot, loot.id);
  }

  // --- XP -------------------------------------------------------------------

  private withRested(amount: number): number {
    const p = this.player();
    const bonus = restedBonus(p.restedXp, amount);
    if (bonus > 0) p.restedXp -= bonus;
    return amount + bonus;
  }

  private grantXp(combatAmt: number, vitalityAmt: number, skill: CombatSkill = "melee"): void {
    const p = this.player();
    if (skill === "ranged") {
      const g = gainXp(p.rangedXp, this.withRested(combatAmt));
      p.rangedXp = g.xp;
      if (g.leveledUp) this.emit(ServerMessage.LevelUp, { skill: "ranged", level: g.level });
    } else if (skill === "magic") {
      const g = gainXp(p.magicXp, this.withRested(combatAmt));
      p.magicXp = g.xp;
      if (g.leveledUp) this.emit(ServerMessage.LevelUp, { skill: "magic", level: g.level });
    } else {
      const melee = gainXp(p.meleeXp, this.withRested(combatAmt));
      p.meleeXp = melee.xp;
      p.level = melee.level; // level == melee level (defence + display)
      if (melee.leveledUp) this.emit(ServerMessage.LevelUp, { skill: "melee", level: melee.level });
    }

    const vitality = gainXp(p.vitalityXp, this.withRested(vitalityAmt));
    p.vitalityXp = vitality.xp;
    if (vitality.leveledUp) {
      const newMax = maxHpForVitality(vitality.level) + equipmentBonus(this.effectiveGear(), itemDef).maxHp;
      const delta = newMax - p.maxHp;
      p.maxHp = newMax;
      if (delta > 0) p.hp = Math.min(newMax, p.hp + delta);
      this.emit(ServerMessage.LevelUp, { skill: "vitality", level: vitality.level });
    }
  }

  private skillXp(skill: NonCombatSkill): number {
    const p = this.player();
    return skill === "mining"
      ? p.miningXp
      : skill === "fishing"
        ? p.fishingXp
        : skill === "smithing"
          ? p.smithingXp
          : p.cookingXp;
  }

  private grantSkillXp(skill: NonCombatSkill, amount: number): void {
    const p = this.player();
    const g = gainXp(this.skillXp(skill), this.withRested(amount));
    if (skill === "mining") p.miningXp = g.xp;
    else if (skill === "fishing") p.fishingXp = g.xp;
    else if (skill === "smithing") p.smithingXp = g.xp;
    else p.cookingXp = g.xp;
    if (g.leveledUp) this.emit(ServerMessage.LevelUp, { skill, level: g.level });
  }

  private awardQuestXp(skill: SkillId, amount: number): void {
    if (skill === "melee") this.grantXp(amount, 0);
    else if (skill === "ranged" || skill === "magic") this.grantXp(amount, 0, skill);
    else if (skill === "vitality") this.grantXp(0, amount);
    else this.grantSkillXp(skill as NonCombatSkill, amount);
  }

  private applyMaxHp(): void {
    const p = this.player();
    const newMax =
      maxHpForVitality(levelForXp(p.vitalityXp)) +
      equipmentBonus(this.effectiveGear(), itemDef).maxHp +
      perkMaxHpBonus(this.chosenPerks) +
      talentMaxHpBonus(this.talents);
    if (newMax === p.maxHp) return;
    p.maxHp = newMax;
    if (p.hp > newMax) p.hp = newMax;
  }

  // --- inventory / equipment / bank ------------------------------------------

  private pushInventory(): void {
    this.emit(ServerMessage.Inventory, { slots: this.inventory });
  }
  private pushEquipment(): void {
    this.emit(ServerMessage.Equipment, { equipment: this.equipment, durability: this.durability });
  }

  /** Wear an equipped item; recompute maxHp if it breaks; push the update. */
  private wearGear(itemId: string | undefined, amount = 1): void {
    if (!itemId) return;
    const def = itemDef(itemId);
    if (!def || !hasDurability(def)) return;
    const before = currentDurability(def, this.durability);
    if (before <= 0) return;
    const after = wear(before, amount);
    this.durability[itemId] = after;
    if (isBroken(after)) this.applyMaxHp();
    this.pushEquipment();
  }

  /** Wear a random equipped armor piece when the player takes a hit. */
  private wearRandomArmor(): void {
    const armor = (Object.entries(this.equipment) as [string, string][]).filter(
      ([slot]) => slot !== "weapon",
    );
    if (armor.length === 0) return;
    this.wearGear(armor[Math.floor(Math.random() * armor.length)]![1]);
  }

  /** Repair all worn equipped gear for coins — only at a vendor. */
  private doRepair(): void {
    const p = this.player();
    if (!p.alive) return;
    const atVendor = vendorsInZone(this.map.id).some(
      (v) => distSq(p.x, p.y, v.x, v.y) <= TALK_RANGE * TALK_RANGE,
    );
    if (!atVendor) return this.system("Find a vendor to repair your gear.");
    let cost = 0;
    const toMend: { itemId: string; max: number }[] = [];
    for (const itemId of Object.values(this.equipment)) {
      const def = itemDef(itemId);
      if (!def || !hasDurability(def)) continue;
      const c = repairCost(def, currentDurability(def, this.durability));
      if (c > 0) {
        cost += c;
        toMend.push({ itemId, max: def.maxDurability! });
      }
    }
    if (toMend.length === 0) return this.system("Your gear is in good repair.");
    if (countItem(this.inventory, "coins") < cost) return this.system(`Repairs cost ${cost} coins.`);
    this.inventory = removeItem(this.inventory, "coins", cost).inventory;
    for (const { itemId, max } of toMend) this.durability[itemId] = max;
    this.applyMaxHp();
    this.pushInventory();
    this.pushEquipment();
    this.system(`Repaired your gear for ${cost} coins.`);
  }
  private pushBank(): void {
    this.emit(ServerMessage.Bank, { slots: this.bank });
  }
  private pushQuests(): void {
    this.emit(ServerMessage.Quests, { quests: this.questLog });
  }
  private pushEmptySocial(): void {
    this.emit(ServerMessage.Friends, { friends: [] });
    this.emit(ServerMessage.Party, { members: [] });
    this.emit(ServerMessage.Guild, { members: [] });
  }

  private doEquip(itemId: string): void {
    const res = equip(this.inventory, this.equipment, itemId, itemDef);
    if (!res.ok) return;
    this.inventory = res.inventory;
    this.equipment = res.equipment;
    this.applyMaxHp();
    this.pushInventory();
    this.pushEquipment();
  }

  private doUnequip(slot: string): void {
    const res = unequip(this.inventory, this.equipment, slot as EquipSlot, itemDef);
    if (!res.ok) return;
    this.inventory = res.inventory;
    this.equipment = res.equipment;
    this.applyMaxHp();
    this.pushInventory();
    this.pushEquipment();
  }

  private doConsume(itemId: string): void {
    const p = this.player();
    if (!p.alive) return;
    const def = itemDef(itemId);
    if (!def || !def.heal || def.heal <= 0) return;
    const removed = removeItem(this.inventory, itemId, 1);
    if (removed.removed <= 0) return;
    this.inventory = removed.inventory;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + def.heal);
    if (p.hp - before > 0) {
      this.emit(ServerMessage.CombatEvent, { attackerId: SOLO_ID, targetId: SOLO_ID, damage: p.hp - before, targetDied: false, heal: true });
    }
    this.pushInventory();
  }

  private doPickup(lootId: string): void {
    const p = this.player();
    if (!p.alive) return;
    const loot = this.state.loot.get(lootId);
    if (!loot) return;
    if (distSq(p.x, p.y, loot.x, loot.y) > PICKUP_RANGE * PICKUP_RANGE) return;
    const def = itemDef(loot.itemId);
    if (!def) {
      this.removeLoot(lootId);
      return;
    }
    const res = addItem(this.inventory, loot.itemId, loot.qty, def.maxStack);
    if (res.added <= 0) return;
    this.inventory = res.inventory;
    if (res.added >= loot.qty) this.removeLoot(lootId);
    else loot.qty -= res.added;
    this.pushInventory();
  }

  private removeLoot(id: string): void {
    if (!this.state.loot.has(id)) return;
    this.state.loot.delete(id);
    this.lootDespawn.delete(id);
    this.fire("loot", "remove", undefined, id);
  }

  private doBankMove(itemId: string, qty: number, dir: "deposit" | "withdraw"): void {
    const p = this.player();
    if (!p.alive || !nearBank(this.map.id, p.x, p.y)) return;
    const def = itemDef(itemId);
    if (!def) return;
    const res =
      dir === "deposit"
        ? deposit(this.inventory, this.bank, def.id, qty, def.maxStack)
        : withdraw(this.inventory, this.bank, def.id, qty, def.maxStack);
    if (res.moved <= 0) return;
    this.inventory = res.inventory;
    this.bank = res.bank;
    this.pushInventory();
    this.pushBank();
  }

  private doGather(nodeId: string): void {
    const p = this.player();
    if (!p.alive) return;
    const resolved = resourceNode(this.map.id, nodeId);
    if (!resolved) return;
    const { node, def } = resolved;
    if (distSq(p.x, p.y, node.x, node.y) > GATHER_RANGE * GATHER_RANGE) return;
    if (levelForXp(this.skillXp(def.skill)) < def.levelReq) {
      this.system(`You need ${def.skill} level ${def.levelReq} for that.`);
      return;
    }
    this.gatherState = { nodeId, finishAt: Date.now() + def.gatherMs };
  }

  private doCraft(recipeId: string): void {
    const p = this.player();
    if (!p.alive) return;
    const recipe = recipeDef(recipeId);
    if (!recipe) return;
    if (levelForXp(this.skillXp(recipe.skill)) < recipe.levelReq) {
      this.system(`You need ${recipe.skill} level ${recipe.levelReq} for that.`);
      return;
    }
    const res = craft(this.inventory, recipe, itemDef);
    if (!res.ok) {
      this.system("You don't have the materials.");
      return;
    }
    this.inventory = res.inventory;
    this.grantSkillXp(recipe.skill, recipe.xp);
    this.pushInventory();
  }

  // --- quests / npcs / vendors -----------------------------------------------

  private doQuestAccept(questId: string): void {
    const def = questDef(questId);
    if (!def || !canAccept(this.questLog, def)) return;
    this.questLog = acceptQuest(this.questLog, def);
    this.pushQuests();
  }

  private doQuestComplete(questId: string): void {
    const def = questDef(questId);
    if (!def) return;
    const qp = findQuest(this.questLog, questId);
    if (!qp || qp.status !== "active") return;
    // Equipped collect items count: auto-unequip what the turn-in needs.
    for (const obj of def.objectives) {
      if (obj.type !== "collect") continue;
      let missing = obj.count - countItem(this.inventory, obj.itemId);
      for (const [slot, itemId] of Object.entries(this.equipment)) {
        if (missing <= 0 || itemId !== obj.itemId) continue;
        const back = addItem(this.inventory, itemId, 1, itemDef(itemId)?.maxStack ?? 1);
        if (back.added <= 0) break;
        this.inventory = back.inventory;
        delete this.equipment[slot as EquipSlot];
        missing -= 1;
      }
    }
    this.applyMaxHp();
    this.pushEquipment();
    if (!questReady(def, qp, this.inventory)) {
      this.system("You haven't finished that quest yet.");
      return;
    }
    for (const obj of def.objectives) {
      if (obj.type !== "collect") continue;
      this.inventory = removeItem(this.inventory, obj.itemId, obj.count).inventory;
    }
    const payouts = [...(def.rewards.items ?? [])];
    if (def.rewards.coins) payouts.push({ itemId: "coins", qty: def.rewards.coins });
    for (const stack of payouts) {
      this.inventory = addItem(this.inventory, stack.itemId, stack.qty, itemDef(stack.itemId)?.maxStack ?? 1).inventory;
    }
    for (const reward of def.rewards.xp ?? []) this.awardQuestXp(reward.skill, reward.amount);
    this.questLog = completeQuest(this.questLog, questId);
    this.pushInventory();
    this.pushQuests();
    this.system(`Quest complete: ${def.name}!`);
  }

  // --- hunts (mirrors the server; the play-test build's retention loop) -------

  private pushHunt(): void {
    this.emit(ServerMessage.Hunt, { task: this.hunt, points: this.huntPts });
  }

  private atHuntmaster(): boolean {
    const npc = npcDef("huntmaster_veyra");
    const p = this.player();
    return !!npc && npc.zone === this.map.id && distSq(p.x, p.y, npc.x, npc.y) <= TALK_RANGE * TALK_RANGE;
  }

  private doHuntAssign(): void {
    if (!this.atHuntmaster()) return this.system("Find Huntmaster Veyra in Meadowbrook for a task.");
    if (this.hunt) return this.system("Finish your current hunt first.");
    this.hunt = rollHunt(Math.random);
    this.system(`Hunt assigned: slay ${this.hunt.remaining} ${mobDef(this.hunt.mob).name}(s).`);
    this.pushHunt();
  }

  private doHuntBuy(itemId: string): void {
    if (!this.atHuntmaster()) return;
    const reward = huntReward(itemId);
    const def = itemDef(itemId);
    if (!reward || !def) return;
    if (this.huntPts < reward.points) return this.system(`That costs ${reward.points} Hunt points.`);
    const res = addItem(this.inventory, def.id, 1, def.maxStack);
    if (res.added <= 0) return this.system("Your bag is full.");
    this.inventory = res.inventory;
    this.huntPts -= reward.points;
    this.pushInventory();
    this.pushHunt();
  }

  // --- mounts (P11) ----------------------------------------------------------

  private pushMount(): void {
    this.emit(ServerMessage.Mount, { owned: this.hasMount });
  }

  private atStabler(): boolean {
    const npc = npcDef("stabler_bran");
    const p = this.player();
    return !!npc && npc.zone === this.map.id && distSq(p.x, p.y, npc.x, npc.y) <= TALK_RANGE * TALK_RANGE;
  }

  private doBuyMount(): void {
    if (this.hasMount) return this.system("You already own a mount.");
    if (!this.atStabler()) return this.system("Find Bran the Stabler in Meadowbrook to buy a mount.");
    if (countItem(this.inventory, "coins") < MOUNT_COST) {
      return this.system(`A mount costs ${MOUNT_COST} coins.`);
    }
    this.inventory = removeItem(this.inventory, "coins", MOUNT_COST).inventory;
    this.hasMount = true;
    this.pushInventory();
    this.pushMount();
    this.system("The elk is yours! Press M to ride.");
  }

  private doToggleMount(): void {
    if (!this.hasMount) return this.system("You don't own a mount. Visit the Stabler in Meadowbrook.");
    this.player().mounted = !this.player().mounted;
  }

  // --- perks (PT.5 skill tree; mirrors ZoneRoom) -------------------------------

  private pushCalling(): void {
    this.emit(ServerMessage.Calling, { calling: this.calling, talents: { ...this.talents } });
  }

  private doChooseCalling(id: unknown): void {
    if (typeof id !== "string" || !(CALLING_IDS as readonly string[]).includes(id)) return;
    if (this.calling === id) return;
    if (this.calling !== "") return this.system("Abandon your current Calling first (respec).");
    this.calling = id as CallingId;
    this.pushCalling();
    this.system("Your Calling is chosen. Press K to shape it.");
  }

  private doSpendTalent(id: unknown): void {
    if (typeof id !== "string") return;
    const pl = this.player();
    const points = talentPointsFor(pl.level, levelForXp(pl.rangedXp), levelForXp(pl.magicXp));
    if (!canSpendTalent(this.calling, this.talents, id, points)) {
      return this.system("You can't take that talent yet.");
    }
    this.talents[id] = (this.talents[id] ?? 0) + 1;
    this.applyMaxHp();
    this.pushCalling();
  }

  private doRespecCalling(): void {
    if (this.calling === "") return this.system("You have no Calling to abandon.");
    if (countItem(this.inventory, "coins") < CALLING_RESPEC_COST) {
      return this.system("Abandoning a Calling costs " + CALLING_RESPEC_COST + " coins.");
    }
    this.inventory = removeItem(this.inventory, "coins", CALLING_RESPEC_COST).inventory;
    this.calling = "";
    this.talents = {};
    this.applyMaxHp();
    this.pushInventory();
    this.pushCalling();
    this.system("Your Calling is forgotten. The roads are open again.");
  }

  private pushPerks(): void {
    this.emit(ServerMessage.Perks, { chosen: [...this.chosenPerks] });
  }

  private doChoosePerk(id: unknown): void {
    if (typeof id !== "string") return;
    if (!canChoosePerk(id, this.player().level, this.chosenPerks)) {
      return this.system("You can't take that perk yet.");
    }
    this.chosenPerks.push(id);
    this.applyMaxHp();
    this.pushPerks();
    this.system("Perk learned. Your training shows.");
  }

  private doRespecPerks(): void {
    if (this.chosenPerks.length === 0) return this.system("You have no perks to reset.");
    if (countItem(this.inventory, "coins") < RESPEC_COST) {
      return this.system(`Resetting your perks costs ${RESPEC_COST} coins.`);
    }
    this.inventory = removeItem(this.inventory, "coins", RESPEC_COST).inventory;
    this.chosenPerks = [];
    this.applyMaxHp();
    this.pushInventory();
    this.pushPerks();
    this.system("Your perks have been reset.");
  }

  // --- world events: zone invasions (P12.3, mirrors the server) ---------------

  private startInvasion(): void {
    if (this.invasionActive || !INVASION_ZONES.has(this.map.id)) return;
    this.invasionActive = true;
    const at = this.map.entries["default"]!;
    this.addEnemy(INVASION_HERALD, at.x + 48, at.y, INVASION_HERALD_ID);
    for (let i = 0; i < INVASION_ESCORTS; i++) {
      const angle = (Math.PI * 2 * i) / INVASION_ESCORTS;
      this.addEnemy(
        INVASION_ESCORT_KIND,
        at.x + 48 + Math.cos(angle) * 72,
        at.y + Math.sin(angle) * 72,
        `${INVASION_ESCORT_PREFIX}${i + 1}`,
      );
    }
    this.system("⚔ An invasion! A warband storms the gate — slay the Invasion Herald to repel it!");
  }

  private endInvasion(): void {
    if (!this.invasionActive) return;
    this.invasionActive = false;
    this.nextInvasionAt = Date.now() + INVASION_INTERVAL_MS;
    this.system("The invasion is repelled! The warband scatters.");
    [...this.state.enemies.keys()]
      .filter((id) => id === INVASION_HERALD_ID || id.startsWith(INVASION_ESCORT_PREFIX))
      .forEach((id) => {
        this.state.enemies.delete(id);
        this.enemyAI.delete(id);
      });
  }

  private doFastTravel(to: string): void {
    if (this.transferring) return;
    const p = this.player();
    const here = waystonesInZone(this.map.id).find(
      (w) => distSq(p.x, p.y, w.x, w.y) <= TALK_RANGE * TALK_RANGE,
    );
    if (!here) return this.system("Stand on a waystone to fast-travel.");
    const dest = waystoneById(to);
    if (!dest || dest.id === here.id) return;
    if (countItem(this.inventory, "coins") < FAST_TRAVEL_COST) {
      return this.system(`Fast travel costs ${FAST_TRAVEL_COST} coins.`);
    }
    this.inventory = removeItem(this.inventory, "coins", FAST_TRAVEL_COST).inventory;
    this.pushInventory();
    this.transferring = true;
    this.persist();
    this.emit(ServerMessage.Transfer, { zone: dest.zone, entry: "default" });
  }

  private doTalk(npcId: string): void {
    const p = this.player();
    const npc = npcDef(npcId);
    if (!npc || npc.zone !== this.map.id) return;
    if (distSq(p.x, p.y, npc.x, npc.y) > TALK_RANGE * TALK_RANGE) return;
    const next = recordTalk(this.questLog, npc.id, questDef);
    if (next !== this.questLog) {
      this.questLog = next;
      this.pushQuests();
    }
  }

  private doTrade(msg: { vendorId: string; itemId: string; qty: number }, dir: "buy" | "sell"): void {
    const p = this.player();
    if (!p.alive) return;
    const vendor = vendorDef(msg.vendorId);
    if (!vendor || vendor.zone !== this.map.id) return;
    if (distSq(p.x, p.y, vendor.x, vendor.y) > TALK_RANGE * TALK_RANGE) return;
    const def = itemDef(msg.itemId);
    if (!def) return;

    if (dir === "buy") {
      if (!vendor.stock.includes(msg.itemId)) return;
      const cost = buyCost(def) * msg.qty;
      if (countItem(this.inventory, "coins") < cost) return this.system("You can't afford that.");
      if (!canAdd(this.inventory, def.id, msg.qty, def.maxStack)) return this.system("Your bag is full.");
      let next = removeItem(this.inventory, "coins", cost).inventory;
      next = addItem(next, def.id, msg.qty, def.maxStack).inventory;
      this.inventory = next;
    } else {
      if (msg.itemId === "coins" || def.value <= 0) return;
      const removed = removeItem(this.inventory, msg.itemId, msg.qty);
      if (removed.removed <= 0) return;
      const pay = sellValue(def) * removed.removed;
      this.inventory = addItem(removed.inventory, "coins", pay, itemDef("coins")?.maxStack ?? 1).inventory;
    }
    this.pushInventory();
  }

  // --- chat + sandbox commands (single-player convenience) -------------------

  private doChat(msg: { channel: string; text: string }): void {
    const command = parseCommand(msg.text);
    if (command) {
      this.runCommand(command.cmd, command.args);
      return;
    }
    this.emit(ServerMessage.Chat, {
      channel: msg.channel === "guild" ? "zone" : msg.channel,
      from: this.player().name,
      zone: this.map.id,
      text: msg.text,
      at: Date.now(),
    });
  }

  /** Solo sandbox commands — free for a single-player play-test (no cheating to worry about). */
  private runCommand(cmd: string, args: string[]): void {
    const p = this.player();
    switch (cmd) {
      case "give": {
        const id = args[0];
        const qty = Math.max(1, Number(args[1] ?? "1") | 0);
        if (!id || !itemDef(id)) return this.system(`Unknown item "${id ?? ""}".`);
        const res = addItem(this.inventory, id, qty, itemDef(id)!.maxStack);
        this.inventory = res.inventory;
        this.pushInventory();
        this.system(`Gave ${res.added}x ${id}.`);
        break;
      }
      case "tp": {
        const x = Number(args[0]);
        const y = Number(args[1]);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          p.x = x;
          p.y = y;
        }
        break;
      }
      case "spawn": {
        const kind = args[0];
        try {
          mobDef(kind ?? "");
        } catch {
          return this.system(`Unknown mob "${kind ?? ""}".`);
        }
        this.addEnemy(kind!, p.x + 48, p.y, `sandbox-${kind}-${++this.lootSeq}`);
        break;
      }
      case "heal":
        p.hp = p.maxHp;
        p.energy = p.maxEnergy;
        break;
      case "setlevel": {
        const lvl = Math.max(1, Math.min(LEVEL_CAP, Number(args[0]) | 0));
        p.meleeXp = xpForLevel(lvl);
        p.level = lvl;
        this.system("Melee level set to " + lvl + ".");
        break;
      }
      case "setskill": {
        const skill = String(args[0] ?? "");
        const lvl = Math.max(1, Math.min(LEVEL_CAP, Number(args[1]) | 0));
        if (!(SKILL_IDS as readonly string[]).includes(skill)) {
          this.system("Usage: /setskill <" + SKILL_IDS.join("|") + "> <level>");
          break;
        }
        const xp = xpForLevel(lvl);
        if (skill === "melee") { p.meleeXp = xp; p.level = lvl; }
        else if (skill === "ranged") p.rangedXp = xp;
        else if (skill === "magic") p.magicXp = xp;
        else if (skill === "vitality") { p.vitalityXp = xp; this.applyMaxHp(); }
        else if (skill === "mining") p.miningXp = xp;
        else if (skill === "fishing") p.fishingXp = xp;
        else if (skill === "smithing") p.smithingXp = xp;
        else if (skill === "cooking") p.cookingXp = xp;
        this.system(skill + " set to level " + lvl + ".");
        break;
      }
      case "maxme": {
        const xp = xpForLevel(LEVEL_CAP);
        p.meleeXp = xp;
        p.level = LEVEL_CAP;
        p.rangedXp = xp;
        p.magicXp = xp;
        p.vitalityXp = xp;
        p.miningXp = xp;
        p.fishingXp = xp;
        p.smithingXp = xp;
        p.cookingXp = xp;
        this.applyMaxHp();
        p.hp = p.maxHp;
        p.energy = p.maxEnergy;
        this.system("Every skill raised to " + LEVEL_CAP + ". Go break something.");
        break;
      }
      case "goto": {
        const id = String(args[0] ?? "");
        if (!mapForId(id)) {
          this.system("Unknown place. Try: meadowbrook, greenreach, marrowgate_downs, tanglewood, ashreach, cinder_depths, refused_column, molten_throne.");
          break;
        }
        if (this.transferring) break;
        this.transferring = true;
        this.persist();
        this.emit(ServerMessage.Transfer, { zone: id, entry: "default" });
        break;
      }
      case "weaken": {
        // Playtest hook: drop every living enemy to N% of max HP (default 25)
        // so boss thresholds (add waves, enrage) can be tested without the grind.
        const pct = Math.max(1, Math.min(100, Number(args[0]) | 0 || 25));
        let hit = 0;
        this.state.enemies.forEach((e) => {
          if (!e.alive) return;
          e.hp = Math.max(1, Math.floor((e.maxHp * pct) / 100));
          hit++;
        });
        this.system("Weakened " + hit + " foes to " + pct + "% HP.");
        break;
      }
      case "raidreset":
        this.raidLock = 0;
        this.system("Raid lockout cleared.");
        break;
      case "mount":
        this.hasMount = true;
        this.pushMount();
        this.system("A spectral elk answers. Press M to ride.");
        break;
      case "invasion":
        if (!INVASION_ZONES.has(this.map.id)) this.system("This zone is never invaded.");
        else if (this.invasionActive) this.system("An invasion is already underway.");
        else this.startInvasion();
        break;
      default:
        this.system(`Unknown command "/${cmd}". Try /give /tp /spawn /heal /invasion.`);
    }
  }

  // --- simulation tick -------------------------------------------------------

  private update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const now = Date.now();
    const p = this.player();

    // Move + regen energy.
    if (p.alive && (this.input.dx !== 0 || this.input.dy !== 0)) {
      const speed = p.mounted ? MOVE_SPEED * MOUNT_SPEED_MULT : MOVE_SPEED;
      const next = stepWithCollision({ x: p.x, y: p.y }, { dx: this.input.dx, dy: this.input.dy }, dt, speed, this.map.collision, PLAYER_HALF);
      p.x = next.x;
      p.y = next.y;
    }
    if (p.energy < p.maxEnergy) p.energy = Math.min(p.maxEnergy, p.energy + ENERGY_REGEN_PER_SEC * dt);

    // World events: the scheduled invasion (single-player keeps them too).
    if (!this.invasionActive && INVASION_ZONES.has(this.map.id) && now >= this.nextInvasionAt) {
      this.startInvasion();
    }

    // Zone exit → persist + hand off to a fresh room (client reboots).
    if (!this.transferring) {
      const exit = exitAt(this.map, p.x, p.y);
      if (exit) {
        this.transferring = true;
        this.persist();
        this.emit(ServerMessage.Transfer, { zone: exit.to, entry: exit.entry });
        return;
      }
    }

    // Mob AI.
    this.state.enemies.forEach((e) => {
      if (e.alive) this.updateMob(e, dt, now);
    });

    // Advance status effects: DoT ticks damage enemies, kills pay the
    // applying skill (mirrors the server's tickActiveEffects).
    this.activeEffects.forEach((list, id) => {
      const { hits, remaining } = tickEffects(list, now);
      if (remaining.length === 0) this.activeEffects.delete(id);
      else this.activeEffects.set(id, remaining);
      if (id === SOLO_ID) {
        for (const hit of hits) {
          if (!p.alive) break;
          p.hp = Math.max(0, p.hp - hit.damage);
          this.emit(ServerMessage.CombatEvent, {
            attackerId: hit.appliedBy,
            targetId: SOLO_ID,
            damage: hit.damage,
            targetDied: p.hp <= 0,
          });
          if (p.hp <= 0) this.killPlayer(now);
        }
        return;
      }
      const enemy = this.state.enemies.get(id);
      if (!enemy || !enemy.alive) return;
      for (const hit of hits) {
        enemy.hp = Math.max(0, enemy.hp - hit.damage);
        this.emit(ServerMessage.CombatEvent, {
          attackerId: SOLO_ID,
          targetId: id,
          damage: hit.damage,
          targetDied: enemy.hp <= 0,
        });
        this.tagged.add(id);
        if (enemy.hp <= 0) {
          this.killEnemy(enemy, now, hit.skill);
          break;
        }
      }
    });

    // Respawn the player. Dying inside a dungeon/raid ejects to its overworld
    // gate (a boss camping the entry made respawning there an endless trap).
    if (!p.alive && this.deadUntil > 0 && now >= this.deadUntil) {
      this.deadUntil = 0;
      p.hp = p.maxHp;
      p.energy = p.maxEnergy;
      p.alive = true;
      const back = mapForId(this.map.id)?.exits[0]?.to;
      if (isDungeonId(this.map.id) && this.map.id !== BG_ZONE && back && !this.transferring) {
        this.system("You fell — the wardens dragged you back outside.");
        this.transferring = true;
        this.persist();
        this.emit(ServerMessage.Transfer, { zone: back, entry: "default" });
        return;
      }
      const entry = this.map.entries["default"]!;
      p.x = entry.x;
      p.y = entry.y;
    }

    // Respawn dead enemies.
    this.state.enemies.forEach((e) => {
      const ai = this.enemyAI.get(e.id);
      if (!e.alive && e.respawnAt > 0 && now >= e.respawnAt && ai) {
        this.activeEffects.delete(e.id);
        this.bossState.delete(e.id);
        // Sandbox-spawned mobs don't respawn — they simply vanish.
        if (e.id.startsWith("sandbox-")) {
          this.state.enemies.delete(e.id);
          this.enemyAI.delete(e.id);
          this.fire("enemies", "remove", undefined, e.id);
          return;
        }
        e.hp = e.maxHp;
        e.alive = true;
        e.respawnAt = 0;
        e.teleAt = 0;
        e.teleRadius = 0;
        e.x = ai.homeX;
        e.y = ai.homeY;
        ai.target = null;
        ai.lastAttackAt = 0;
        ai.teleReadyAt = 0;
      }
    });

    if (this.pendingAdds.length > 0) {
      for (const a of this.pendingAdds) this.addEnemy(a.kind, a.x, a.y, a.id);
      this.pendingAdds = [];
    }

    // Despawn ground loot.
    this.state.loot.forEach((_l, id) => {
      const at = this.lootDespawn.get(id);
      if (at !== undefined && now >= at) this.removeLoot(id);
    });

    // Gathering (auto-repeat while still + in range).
    if (this.gatherState) {
      const g = this.gatherState;
      const resolved = resourceNode(this.map.id, g.nodeId);
      const moving = this.input.dx !== 0 || this.input.dy !== 0;
      if (!p.alive || !resolved || moving || distSq(p.x, p.y, resolved.node.x, resolved.node.y) > GATHER_RANGE * GATHER_RANGE) {
        this.gatherState = null;
      } else if (now >= g.finishAt) {
        const res = addItem(this.inventory, resolved.def.itemId, 1, itemDef(resolved.def.itemId)?.maxStack ?? 1);
        if (res.added <= 0) {
          this.gatherState = null;
          this.system("Your bag is full.");
        } else {
          this.inventory = res.inventory;
          this.grantSkillXp(resolved.def.skill, resolved.def.xp);
          this.pushInventory();
          g.finishAt = now + resolved.def.gatherMs;
        }
      }
    }
  }

  private updateMob(e: EnemySchema, dt: number, now: number): void {
    const def = mobDef(e.kind);
    if (def.aggroRadius <= 0) return;
    const ai = this.enemyAI.get(e.id);
    if (!ai) return;
    const p = this.player();

    if (def.telegraph && e.teleAt > 0) {
      if (now >= e.teleAt) {
        this.resolveTelegraph(e, def.telegraph, now);
        const vs = this.bossState.get(e.id);
        if (vs && vs.volleyLeft > 0 && p.alive && ai.target) {
          vs.volleyLeft--;
          e.teleX = p.x;
          e.teleY = p.y;
          e.teleRadius = def.telegraph.radius;
          e.teleAt = now + Math.round(def.telegraph.windupMs * 0.75);
        } else {
          ai.teleReadyAt = now + def.telegraph.cooldownMs;
        }
      }
      return;
    }

    // Boss mechanics (P15.1) — mirrors the server exactly.
    const mech = def.mechanics;
    let bs = this.bossState.get(e.id);
    if (mech && !bs) {
      bs = { firedAdds: new Set<number>(), lastBlinkAt: now, volleyLeft: 0 };
      this.bossState.set(e.id, bs);
    }
    if (mech?.addsAtHpPct && bs) {
      for (const wave of mech.addsAtHpPct) {
        if (e.hp <= e.maxHp * wave.pct && !bs.firedAdds.has(wave.pct)) {
          bs.firedAdds.add(wave.pct);
          for (let i = 0; i < wave.count; i++) {
            const ang = (Math.PI * 2 * i) / wave.count;
            this.pendingAdds.push({
              kind: wave.kind,
              x: e.x + Math.cos(ang) * 64,
              y: e.y + Math.sin(ang) * 64,
              id: `add-${e.id}-${++this.addSeq}`,
            });
          }
          this.system(`${e.name} calls for aid!`);
        }
      }
    }

    const homeDist = Math.hypot(e.x - ai.homeX, e.y - ai.homeY);
    let target = ai.target ? this.state.players.get(ai.target) : undefined;
    if (target && (!target.alive || homeDist > def.leashRadius || Math.hypot(e.x - target.x, e.y - target.y) > def.leashRadius)) {
      target = undefined;
      ai.target = null;
    }
    if (!target && homeDist <= def.leashRadius && p.alive && Math.hypot(e.x - p.x, e.y - p.y) <= def.aggroRadius) {
      target = p;
      ai.target = SOLO_ID;
    }

    if (target && ai.target) {
      if (mech?.blinkEveryMs && bs && now - bs.lastBlinkAt >= mech.blinkEveryMs) {
        bs.lastBlinkAt = now;
        e.x = target.x + (e.x >= target.x ? 44 : -44);
        e.y = target.y;
      }
      if (def.telegraph && now >= ai.teleReadyAt) {
        if (bs) bs.volleyLeft = (mech?.telegraphVolley ?? 1) - 1;
        e.teleX = target.x;
        e.teleY = target.y;
        e.teleRadius = def.telegraph.radius;
        e.teleAt = now + def.telegraph.windupMs;
        return;
      }
      const enraged = mech?.enrage && e.hp <= e.maxHp * mech.enrage.pct ? mech.enrage : undefined;
      const d = Math.hypot(e.x - target.x, e.y - target.y);
      if (d > def.attackRange) {
        this.moveToward(
          e,
          target.x,
          target.y,
          def.moveSpeed * (enraged?.moveMult ?? 1) * moveMultOf(this.activeEffects.get(e.id) ?? [], now),
          dt,
        );
      } else if (now - ai.lastAttackAt >= def.attackCooldownMs * (enraged?.cooldownMult ?? 1)) {
        ai.lastAttackAt = now;
        const result = resolveAttack(this.mobStats(e), this.playerStats());
        if (result.hit) {
          target.hp = result.targetHpAfter;
          if (mech?.onHitEffect && !result.targetDied) {
            this.activeEffects.set(
              SOLO_ID,
              applyEffect(this.activeEffects.get(SOLO_ID) ?? [], mech.onHitEffect, e.id, "melee", now),
            );
          }
          this.wearRandomArmor(); // taking a hit wears armor
          this.emit(ServerMessage.CombatEvent, { attackerId: e.id, targetId: ai.target, damage: result.damage, targetDied: result.targetDied });
          if (result.targetDied) this.killPlayer(now);
        }
      }
    } else if (homeDist > 4) {
      this.moveToward(e, ai.homeX, ai.homeY, def.moveSpeed, dt);
    }
  }

  private resolveTelegraph(e: EnemySchema, tele: TelegraphDef, now: number): void {
    const p = this.player();
    if (p.alive && distSq(p.x, p.y, e.teleX, e.teleY) <= tele.radius * tele.radius) {
      p.hp = Math.max(0, p.hp - tele.damage);
      this.wearRandomArmor(); // caught by the slam
      this.emit(ServerMessage.CombatEvent, { attackerId: e.id, targetId: SOLO_ID, damage: tele.damage, targetDied: p.hp <= 0 });
      if (p.hp <= 0) this.killPlayer(now);
    }
    e.teleAt = 0;
    e.teleRadius = 0;
  }

  private moveToward(e: EnemySchema, tx: number, ty: number, speed: number, dt: number): void {
    const next = stepWithCollision({ x: e.x, y: e.y }, { dx: tx - e.x, dy: ty - e.y }, dt, speed, this.map.collision, ENEMY_HALF);
    e.x = next.x;
    e.y = next.y;
  }

  private killPlayer(now: number): void {
    const p = this.player();
    p.alive = false;
    p.hp = 0;
    p.mounted = false;
    this.deadUntil = now + PLAYER_RESPAWN_MS;
    this.input.dx = 0;
    this.input.dy = 0;
    this.enemyAI.forEach((ai) => {
      if (ai.target === SOLO_ID) ai.target = null;
    });
    // Death stings: every equipped piece takes a durability hit.
    let wore = false;
    for (const itemId of Object.values(this.equipment)) {
      const def = itemId ? itemDef(itemId) : undefined;
      if (!itemId || !def || !hasDurability(def)) continue;
      const before = currentDurability(def, this.durability);
      if (before <= 0) continue;
      this.durability[itemId] = wear(before, DEATH_DURABILITY_LOSS);
      wore = true;
    }
    if (wore) {
      this.applyMaxHp();
      this.pushEquipment();
      this.system("Death has worn your gear — repair it at a vendor.");
    }
  }

  // --- persistence -----------------------------------------------------------

  private persist(): void {
    const p = this.player();
    const save: SoloSave = {
      name: p.name,
      zone: this.map.id,
      x: p.x,
      y: p.y,
      hp: p.hp,
      meleeXp: p.meleeXp,
      rangedXp: p.rangedXp,
      magicXp: p.magicXp,
      vitalityXp: p.vitalityXp,
      miningXp: p.miningXp,
      fishingXp: p.fishingXp,
      smithingXp: p.smithingXp,
      cookingXp: p.cookingXp,
      restedXp: p.restedXp,
      inventory: this.inventory,
      equipment: this.equipment,
      durability: this.durability,
      bank: this.bank,
      quests: this.questLog,
      hunt: this.hunt,
      huntPoints: this.huntPts,
      hasMount: this.hasMount,
      raidLockUntil: this.raidLock,
      perks: this.chosenPerks,
      calling: this.calling,
      talents: this.talents,
      lastSeen: Date.now(),
    };
    // A dungeon/raid is not a safe resume point — store the overworld the
    // gate returns to (mirrors the server's finalizeSnapshot).
    const back = mapForId(this.map.id)?.exits[0]?.to;
    if ((this.map.id === "cinder_depths" || this.map.id === RAID_ZONE) && back) save.zone = back;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      localStorage.setItem("mmo:zone", save.zone);
    } catch {
      // storage full / disabled — a play-test can continue without a save
    }
    this.save = save;
  }
}
