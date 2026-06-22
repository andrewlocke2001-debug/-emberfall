import { Room, ServerError, type Client } from "@colyseus/core";
import {
  ABILITIES,
  ClientMessage,
  MOVE_SPEED,
  ServerMessage,
  TICK_MS,
  GCD_MS,
  ENERGY_REGEN_PER_SEC,
  PICKUP_RANGE,
  LOOT_OWNERSHIP_MS,
  LOOT_DESPAWN_MS,
  distSq,
  type CombatEventPayload,
  type JoinZoneOptions,
  type MovePayload,
  type UseAbilityPayload,
  type WelcomePayload,
  type TransferPayload,
  type ChatPayload,
  type ChatBroadcastPayload,
  type LevelUpPayload,
  type SkillId,
  type InventoryPayload,
  type EquipPayload,
  type UnequipPayload,
  type EquipmentPayload,
  type PickupPayload,
  type BankMovePayload,
  type BankPayload,
} from "@mmo/shared";
import { addItem, type Inventory } from "@mmo/shared/systems/inventory";
import {
  equip,
  unequip,
  equipmentBonus,
  type Equipment,
} from "@mmo/shared/systems/equipment";
import { deposit, withdraw, type Bank } from "@mmo/shared/systems/bank";
import { itemDef, ITEM_IDS } from "@mmo/shared/data/items";
import { nearBank } from "@mmo/shared/data/banks";
import { EnemySchema, PlayerSchema, ZoneState, GroundLootSchema } from "@mmo/shared/schema/state";
import {
  MoveSchema,
  UseAbilitySchema,
  ChatSchema,
  EquipSchema,
  UnequipSchema,
  PickupSchema,
  BankMoveSchema,
} from "@mmo/shared/protocol/schemas";
import { rollDrops } from "@mmo/shared/systems/loot";
import { stepWithCollision, isBoxFree } from "@mmo/shared/systems/collision";
import { resolveAttack, type CombatStats } from "@mmo/shared/systems/combatmath";
import {
  combatStatsFromLevel,
  gainXp,
  levelForXp,
  maxHpForVitality,
} from "@mmo/shared/systems/progression";
import { ZONES, DEFAULT_ZONE, isZoneId } from "@mmo/shared/data/zones";
import { mobDef, MOBS } from "@mmo/shared/data/mobs";
import { exitAt, type ZoneMap } from "@mmo/shared/systems/zonemap";
import { RateLimiter } from "@mmo/shared/systems/ratelimit";
import { parseCommand, isGm, parseGmAllowlist, type GmCommand } from "@mmo/shared/systems/gm";
import { verifyToken } from "../auth";
import { censorText } from "../chat";
import { globalBus } from "../services/globalBus";
import { characterStore, type SavedCharacter } from "../persistence/store";
import { recordLedger } from "../persistence/ledger";

const SNAPSHOT_INTERVAL_MS = 15_000;
const PLAYER_HALF = 12; // half-extent of a player's collision box, world units
const ENEMY_HALF = 12; // half-extent of a mob's collision box
const PLAYER_RESPAWN_MS = 5000; // delay before a slain player respawns
/** Fraction of a kill's melee XP that also feeds Vitality (HP) growth. */
const VITALITY_XP_FRACTION = 1 / 3;

/** Per-session transient input — never synced, never trusted as state. */
interface InputState {
  dx: number;
  dy: number;
  playerId: string;
}

/**
 * The authoritative game room for a single zone.
 *
 * Clients send *intent* (movement direction, "use ability on target"); this
 * room validates it and mutates `ZoneState`. Colyseus delta-syncs the mutated
 * state to every client. No client-reported position or damage is ever trusted.
 */
export class ZoneRoom extends Room<{ state: ZoneState }> {
  override maxClients = 50;

  /**
   * Hard transport-level flood ceiling — Colyseus disconnects any client
   * exceeding it. Movement intents are edge-triggered (sent on input change),
   * so 30/s is generous for honest clients and cheap insurance against spam.
   */
  override maxMessagesPerSecond = 30;

  private inputs = new Map<string, InputState>();
  private map!: ZoneMap;
  /** Sessions already handed off to another zone (don't re-trigger the exit). */
  private transferring = new Set<string>();
  /** Per-session chat throttle: 5 messages / 10s. */
  private readonly chatLimiter = new RateLimiter(5, 10_000);
  /** Unsubscribe handle for the global-chat bus (set in onCreate). */
  private unsubscribeGlobal?: () => void;
  /** Per-enemy AI: spawn home, current target session, last attack time. */
  private readonly enemyAI = new Map<
    string,
    { homeX: number; homeY: number; target: string | null; lastAttackAt: number }
  >();
  /**
   * Per-enemy set of session ids that have damaged it this life. Everyone who
   * contributed shares full kill credit (GW2-style tagging) — no last-hit or
   * damage-weighted stealing. Cleared when the mob dies (XP awarded) or
   * respawns (fresh life).
   */
  private readonly mobContributors = new Map<string, Set<string>>();
  /** Dead players → the server time at which they respawn. */
  private readonly deadUntil = new Map<string, number>();
  /** Per-session global-cooldown expiry (server time, ms). */
  private readonly gcdUntil = new Map<string, number>();
  /** Per-session per-ability cooldown expiry (server time, ms). */
  private readonly abilityCooldowns = new Map<string, Map<string, number>>();
  /** GM allowlist (from GM_USERNAMES), resolved once in onCreate. */
  private gmAllow = new Set<string>();
  /** Sessions whose account is a GM (may run slash commands). */
  private readonly gmSessions = new Set<string>();
  /** Monotonic counter for unique GM-spawned mob ids. */
  private gmSpawnCount = 0;
  /** Monotonic counter for unique ground-loot ids. */
  private lootSeq = 0;
  /** Ground-loot id → server time (ms) at which it despawns (server-only). */
  private readonly lootDespawn = new Map<string, number>();
  /**
   * Authoritative per-session inventory, kept OUT of synced state so bags
   * aren't broadcast to other clients. Loaded on join, pushed to the owner via
   * an Inventory message, persisted on leave/snapshot.
   */
  private readonly inventories = new Map<string, Inventory>();
  /** Authoritative per-session equipped gear (slot → itemId), off synced state
   *  like inventory. Drives combat-stat bonuses; persisted with the character. */
  private readonly equipment = new Map<string, Equipment>();
  /** Authoritative per-session bank storage (off synced state, persisted). */
  private readonly banks = new Map<string, Bank>();

  override onCreate(options?: { zoneId?: string }): void {
    const zoneId =
      options?.zoneId && isZoneId(options.zoneId) ? options.zoneId : DEFAULT_ZONE;
    this.map = ZONES[zoneId];

    this.gmAllow = parseGmAllowlist(process.env["GM_USERNAMES"]);

    this.state = new ZoneState();
    this.state.zoneId = this.map.id;
    this.spawnEnemies();

    // Every inbound message is zod-validated by Colyseus before our handler
    // runs (kit rule #2). A payload that fails the schema gets the client
    // disconnected with CloseCode.WITH_ERROR — validated input is trusted
    // input from here on.
    this.onMessage(ClientMessage.Move, MoveSchema, (client, msg: MovePayload) => {
      const input = this.inputs.get(client.sessionId);
      if (!input) return;
      input.dx = msg.dx;
      input.dy = msg.dy;
    });

    this.onMessage(ClientMessage.UseAbility, UseAbilitySchema, (client, msg: UseAbilityPayload) => {
      this.handleUseAbility(client, msg);
    });

    this.onMessage(ClientMessage.Chat, ChatSchema, (client, msg: ChatPayload) => {
      this.handleChat(client, msg);
    });

    // No payload to validate — only ever re-sends the caller their own loadout,
    // so there's no injection surface. Lets the client pull inventory +
    // equipment once its handlers exist (the onJoin push can lose the race).
    this.onMessage(ClientMessage.RequestInventory, (client) => {
      this.sendInventory(client);
      this.sendEquipment(client);
    });

    this.onMessage(ClientMessage.Equip, EquipSchema, (client, msg: EquipPayload) => {
      this.handleEquip(client, msg);
    });

    this.onMessage(ClientMessage.Unequip, UnequipSchema, (client, msg: UnequipPayload) => {
      this.handleUnequip(client, msg);
    });

    this.onMessage(ClientMessage.Pickup, PickupSchema, (client, msg: PickupPayload) => {
      this.handlePickup(client, msg);
    });

    this.onMessage(ClientMessage.RequestBank, (client) => this.sendBankIfNear(client));
    this.onMessage(ClientMessage.Deposit, BankMoveSchema, (client, msg: BankMovePayload) => {
      this.handleBankMove(client, msg, "deposit");
    });
    this.onMessage(ClientMessage.Withdraw, BankMoveSchema, (client, msg: BankMovePayload) => {
      this.handleBankMove(client, msg, "withdraw");
    });

    // Global chat arrives from any zone in this process — fan it out to ours.
    this.unsubscribeGlobal = globalBus.onChat((payload) => {
      this.broadcast(ServerMessage.Chat, payload);
    });

    // The authoritative game loop.
    this.setSimulationInterval((dt) => this.update(dt), TICK_MS);

    // Periodically snapshot all online characters so a crash loses little.
    this.clock.setInterval(() => this.snapshotAll(), SNAPSHOT_INTERVAL_MS);
  }

  override async onJoin(client: Client, options: JoinZoneOptions): Promise<void> {
    // Identity comes from the verified token, never from a client-supplied id.
    const claims = await verifyToken(options?.token ?? "");
    if (!claims) throw new ServerError(401, "Not authenticated. Please log in again.");
    const playerId = claims.accountId;
    const name = claims.username;

    const def = this.map.entries["default"]!;
    const saved = await characterStore.loadOrCreate(playerId, name, this.map.id, def);

    // Spawn priority: a named entry (arriving through a gate) wins; otherwise
    // the saved position, unless it's from another zone or now blocked/off-map
    // (e.g. after a map change) — then fall back to the zone's default entry.
    const namedEntry = options?.entry ? this.map.entries[options.entry] : undefined;
    let spawnX: number;
    let spawnY: number;
    if (namedEntry) {
      spawnX = namedEntry.x;
      spawnY = namedEntry.y;
    } else if (saved.zone === this.map.id && isBoxFree(this.map.collision, saved.x, saved.y, PLAYER_HALF)) {
      spawnX = saved.x;
      spawnY = saved.y;
    } else {
      spawnX = def.x;
      spawnY = def.y;
    }

    const player = new PlayerSchema();
    player.id = playerId;
    player.name = saved.name;
    player.x = spawnX;
    player.y = spawnY;
    // Levels are derived from the authoritative XP totals, never trusted from
    // the saved level/maxHp columns (which are denormalized convenience only).
    player.meleeXp = saved.meleeXp;
    player.vitalityXp = saved.vitalityXp;
    player.level = levelForXp(saved.meleeXp);
    // maxHp = Vitality curve + equipped gear's maxHp bonus.
    player.maxHp =
      maxHpForVitality(levelForXp(saved.vitalityXp)) +
      equipmentBonus(saved.equipment, itemDef).maxHp;
    // Saved hp can exceed maxHp only if the curve/gear changed; clamp defensively.
    player.hp = Math.min(saved.hp, player.maxHp);
    player.alive = saved.hp > 0;
    this.state.players.set(client.sessionId, player);
    this.inputs.set(client.sessionId, { dx: 0, dy: 0, playerId });
    this.inventories.set(client.sessionId, saved.inventory);
    this.equipment.set(client.sessionId, saved.equipment);
    this.banks.set(client.sessionId, saved.bank);
    this.sendInventory(client);
    this.sendEquipment(client);

    if (isGm(name, this.gmAllow)) {
      this.gmSessions.add(client.sessionId);
      console.log(`[gm] ${name} (${playerId}) joined as GM`);
    }

    const welcome: WelcomePayload = { sessionId: client.sessionId, playerId };
    client.send(ServerMessage.Welcome, welcome);
    console.log(`[zone] ${name} (${playerId}) joined as ${client.sessionId}`);
  }

  override async onLeave(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.transferring.delete(client.sessionId);
    this.chatLimiter.forget(client.sessionId);
    this.deadUntil.delete(client.sessionId);
    this.gcdUntil.delete(client.sessionId);
    this.abilityCooldowns.delete(client.sessionId);
    this.gmSessions.delete(client.sessionId);
    this.enemyAI.forEach((ai) => {
      if (ai.target === client.sessionId) ai.target = null;
    });
    this.mobContributors.forEach((set) => set.delete(client.sessionId));
    const inventory = this.inventories.get(client.sessionId) ?? [];
    const equipment = this.equipment.get(client.sessionId) ?? {};
    const bank = this.banks.get(client.sessionId) ?? [];
    this.inventories.delete(client.sessionId);
    this.equipment.delete(client.sessionId);
    this.banks.delete(client.sessionId);
    if (!player) return;

    const snapshot = toSaved(player, this.map.id, inventory, equipment, bank);
    this.state.players.delete(client.sessionId);
    try {
      await characterStore.save(snapshot);
    } catch (err) {
      console.error(`[zone] failed to save ${snapshot.playerId} on leave:`, err);
    }
  }

  override async onDispose(): Promise<void> {
    this.unsubscribeGlobal?.();
    await this.snapshotAll();
  }

  // --- internals -----------------------------------------------------------

  /** Spawn this zone's mobs from the map's enemy markers (stats from data). */
  private spawnEnemies(): void {
    this.map.enemies.forEach((marker, i) => {
      this.addEnemy(marker.kind, marker.x, marker.y, `${mobDef(marker.kind).kind}-${i + 1}`);
    });
  }

  /** Create a mob of `kind` at (x,y) with id, wiring its AI + credit tracking. */
  private addEnemy(kind: string, x: number, y: number, id: string): EnemySchema {
    const def = mobDef(kind);
    const enemy = new EnemySchema();
    enemy.id = id;
    enemy.kind = def.kind;
    enemy.name = def.name;
    enemy.x = x;
    enemy.y = y;
    enemy.hp = def.maxHp;
    enemy.maxHp = def.maxHp;
    enemy.alive = true;
    this.state.enemies.set(enemy.id, enemy);
    this.enemyAI.set(enemy.id, { homeX: x, homeY: y, target: null, lastAttackAt: 0 });
    this.mobContributors.set(enemy.id, new Set());
    return enemy;
  }

  private handleUseAbility(client: Client, msg: UseAbilityPayload): void {
    const sessionId = client.sessionId;
    const player = this.state.players.get(sessionId);
    if (!player || !player.alive) return;

    const ability = ABILITIES[msg.abilityId];
    if (!ability) return;

    // Gate on the global cooldown, this ability's own cooldown, and energy.
    const now = Date.now();
    const onGcd = ability.onGcd ?? true;
    if (onGcd && now < (this.gcdUntil.get(sessionId) ?? 0)) return;
    if (now < (this.abilityCooldowns.get(sessionId)?.get(ability.id) ?? 0)) return;
    const cost = ability.energyCost ?? 0;
    if (player.energy < cost) return;

    if (ability.kind === "heal") {
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + (ability.heal ?? 0));
      this.commitAbility(sessionId, ability, now);
      player.energy -= cost;
      const restored = player.hp - before;
      if (restored > 0) {
        this.broadcast(ServerMessage.CombatEvent, {
          attackerId: sessionId,
          targetId: sessionId,
          damage: restored,
          targetDied: false,
          heal: true,
        });
      }
      return;
    }

    // Attack — enemies only (no open-world PvP in P2).
    const enemy = this.state.enemies.get(msg.targetId);
    if (!enemy || !enemy.alive) return;
    if (distSq(player.x, player.y, enemy.x, enemy.y) > ability.range * ability.range) return;

    const atk = this.playerStats(sessionId, player);
    atk.strength = Math.round(atk.strength * (ability.strengthMul ?? 1));
    const result = resolveAttack(atk, mobCombatStats(enemy));

    // The swing happens regardless of hit/miss → it costs energy + cooldown.
    this.commitAbility(sessionId, ability, now);
    player.energy -= cost;

    if (result.hit) {
      enemy.hp = result.targetHpAfter;
      // Tag this player as a contributor — landing a hit earns kill credit.
      this.mobContributors.get(enemy.id)?.add(sessionId);
      const evt: CombatEventPayload = {
        attackerId: sessionId,
        targetId: enemy.id,
        damage: result.damage,
        targetDied: result.targetDied,
      };
      this.broadcast(ServerMessage.CombatEvent, evt);
      if (result.targetDied) {
        enemy.alive = false;
        enemy.respawnAt = now + mobDef(enemy.kind).respawnMs;
        this.awardKill(enemy);
      }
    }
  }

  /**
   * Grant a slain mob's XP to every player who tagged it (shared credit), then
   * clear the tag set for its next life. Players who have since left the room
   * are skipped — their progress was already written on leave.
   */
  private awardKill(enemy: EnemySchema): void {
    const contributors = this.mobContributors.get(enemy.id);
    if (!contributors || contributors.size === 0) return;
    const def = mobDef(enemy.kind);
    const meleeAmt = def.xpReward;
    const vitalityAmt = Math.floor(def.xpReward * VITALITY_XP_FRACTION);
    const now = Date.now();
    // GW2-style: every contributor gets XP and their OWN loot roll (no steals).
    contributors.forEach((sessionId) => {
      const player = this.state.players.get(sessionId);
      if (!player) return;
      this.grantXp(sessionId, player, meleeAmt, vitalityAmt);
      for (const stack of rollDrops(def.drops)) {
        this.spawnLoot(stack.itemId, stack.qty, enemy.x, enemy.y, player.id, now);
      }
    });
    contributors.clear();
  }

  /** Drop a pile of ground loot near (x,y), reserved to `ownerId` for a while. */
  private spawnLoot(itemId: string, qty: number, x: number, y: number, ownerId: string, now: number): void {
    const loot = new GroundLootSchema();
    loot.id = `loot-${++this.lootSeq}`;
    loot.itemId = itemId;
    loot.qty = qty;
    loot.x = x + (Math.random() * 32 - 16); // small scatter so piles don't overlap
    loot.y = y + (Math.random() * 32 - 16);
    loot.ownerId = ownerId;
    loot.ownerUntil = now + LOOT_OWNERSHIP_MS;
    this.state.loot.set(loot.id, loot);
    this.lootDespawn.set(loot.id, now + LOOT_DESPAWN_MS);
  }

  /**
   * Apply XP to a player's two skills, leveling them and broadcasting feedback.
   * Melee level drives combat stats (kept in `player.level`); Vitality level
   * drives maxHp — a Vitality level-up raises maxHp and heals by the gain so a
   * fresh level is never a downgrade mid-fight.
   */
  private grantXp(sessionId: string, player: PlayerSchema, meleeAmt: number, vitalityAmt: number): void {
    const melee = gainXp(player.meleeXp, meleeAmt);
    player.meleeXp = melee.xp;
    player.level = melee.level; // keep level == melee level even without a tick-up
    if (melee.leveledUp) this.sendLevelUp(sessionId, "melee", melee.level);

    const vitality = gainXp(player.vitalityXp, vitalityAmt);
    player.vitalityXp = vitality.xp;
    if (vitality.leveledUp) {
      const newMax = this.maxHpFor(sessionId, player); // Vitality curve + gear
      const delta = newMax - player.maxHp;
      player.maxHp = newMax;
      if (delta > 0) player.hp = Math.min(newMax, player.hp + delta);
      this.sendLevelUp(sessionId, "vitality", vitality.level);
    }
  }

  /** Tell just the leveling player which skill ticked up (for UI feedback). */
  private sendLevelUp(sessionId: string, skill: SkillId, level: number): void {
    const payload: LevelUpPayload = { skill, level };
    this.clients.find((c) => c.sessionId === sessionId)?.send(ServerMessage.LevelUp, payload);
  }

  /** Start the GCD (if applicable) and this ability's own cooldown. */
  private commitAbility(sessionId: string, ability: { id: string; cooldownMs: number; onGcd?: boolean }, now: number): void {
    if (ability.onGcd ?? true) this.gcdUntil.set(sessionId, now + GCD_MS);
    if (ability.cooldownMs > 0) {
      let cds = this.abilityCooldowns.get(sessionId);
      if (!cds) {
        cds = new Map();
        this.abilityCooldowns.set(sessionId, cds);
      }
      cds.set(ability.id, now + ability.cooldownMs);
    }
  }

  private handleChat(client: Client, msg: ChatPayload): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    // Slash commands never broadcast — they're intercepted (and role-gated)
    // before the chat path. A non-GM typing one just gets a private refusal.
    const command = parseCommand(msg.text);
    if (command) {
      this.handleGmCommand(client, player, command);
      return;
    }

    if (!this.chatLimiter.allow(client.sessionId)) return; // drop spam silently
    const text = censorText(msg.text).trim().slice(0, 200);
    if (!text) return;

    const payload: ChatBroadcastPayload = {
      channel: msg.channel,
      from: player.name,
      zone: this.map.id,
      text,
      at: Date.now(),
    };
    if (msg.channel === "global") {
      globalBus.publishChat(payload); // fans out to every room, including this one
    } else {
      this.broadcast(ServerMessage.Chat, payload);
    }
  }

  // --- GM commands (role-gated, audit-logged) --------------------------------

  /** Dispatch a parsed slash command if the sender is a GM. */
  private handleGmCommand(client: Client, player: PlayerSchema, command: GmCommand): void {
    if (!this.gmSessions.has(client.sessionId)) {
      this.systemTo(client, "You don't have permission to use commands.");
      return;
    }
    const { cmd, args } = command;
    switch (cmd) {
      case "heal":
        this.gmHeal(client, player, args);
        break;
      case "tp":
        this.gmTeleport(client, player, args);
        break;
      case "spawn":
        this.gmSpawn(client, player, args);
        break;
      case "give":
        this.gmGive(client, player, args);
        break;
      case "droploot":
        this.gmDropLoot(client, player, args);
        break;
      case "kick":
        this.gmKick(client, args);
        break;
      default:
        this.systemTo(client, `Unknown command: /${cmd}`);
        return; // unknown → no audit line
    }
    // Audit trail — every executed GM command (goes to server logs / fly logs).
    console.log(`[gm] ${player.name} ran /${cmd} ${args.join(" ")}`.trimEnd());
  }

  /** /heal [name] — fully restore (and revive) self or a named player. */
  private gmHeal(client: Client, self: PlayerSchema, args: string[]): void {
    const target = args[0] ? this.findPlayer(args[0]) : { sessionId: client.sessionId, player: self };
    if (!target) {
      this.systemTo(client, `No player named "${args[0]}".`);
      return;
    }
    const p = target.player;
    p.hp = p.maxHp;
    p.energy = p.maxEnergy;
    if (!p.alive) {
      p.alive = true;
      this.deadUntil.delete(target.sessionId);
    }
    this.systemTo(client, `Healed ${p.name}.`);
  }

  /** /tp <x> <y> — teleport self to a free, in-bounds point. */
  private gmTeleport(client: Client, self: PlayerSchema, args: string[]): void {
    const x = Number(args[0]);
    const y = Number(args[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      this.systemTo(client, "Usage: /tp <x> <y>");
      return;
    }
    const inBounds = x >= 0 && y >= 0 && x <= this.map.pixelWidth && y <= this.map.pixelHeight;
    if (!inBounds || !isBoxFree(this.map.collision, x, y, PLAYER_HALF)) {
      this.systemTo(client, "Can't teleport there (off-map or blocked).");
      return;
    }
    self.x = x;
    self.y = y;
    this.systemTo(client, `Teleported to ${Math.round(x)}, ${Math.round(y)}.`);
  }

  /** /spawn <kind> — drop a mob of a known family next to the GM. */
  private gmSpawn(client: Client, self: PlayerSchema, args: string[]): void {
    const kind = (args[0] ?? "").toLowerCase();
    if (!MOBS[kind]) {
      this.systemTo(client, `Unknown mob "${kind}". Known: ${Object.keys(MOBS).join(", ")}`);
      return;
    }
    const enemy = this.addEnemy(kind, self.x + 40, self.y, `gm-${kind}-${++this.gmSpawnCount}`);
    this.systemTo(client, `Spawned ${enemy.name} (${enemy.id}).`);
  }

  /** /give <itemId> [qty] — create items into the GM's bag (audited). */
  private gmGive(client: Client, self: PlayerSchema, args: string[]): void {
    const id = args[0] ?? "";
    const def = itemDef(id);
    if (!def) {
      this.systemTo(client, `Unknown item "${id}". Known: ${ITEM_IDS.join(", ")}`);
      return;
    }
    const qty = Math.max(1, Math.floor(Number(args[1] ?? 1)) || 1);
    const inv = this.inventories.get(client.sessionId) ?? [];
    const res = addItem(inv, def.id, qty, def.maxStack);
    this.inventories.set(client.sessionId, res.inventory);
    if (res.added > 0) {
      void recordLedger({ account: self.id, itemId: def.id, delta: res.added, reason: "gm_give" });
      this.sendInventory(client);
    }
    this.systemTo(
      client,
      res.added < qty
        ? `Gave ${res.added}× ${def.name} (bag full, ${qty - res.added} lost).`
        : `Gave ${res.added}× ${def.name}.`,
    );
  }

  /** /droploot <itemId> [qty] — drop a ground-loot pile at the GM's feet. */
  private gmDropLoot(client: Client, self: PlayerSchema, args: string[]): void {
    const id = args[0] ?? "";
    const def = itemDef(id);
    if (!def) {
      this.systemTo(client, `Unknown item "${id}". Known: ${ITEM_IDS.join(", ")}`);
      return;
    }
    const qty = Math.max(1, Math.floor(Number(args[1] ?? 1)) || 1);
    this.spawnLoot(def.id, qty, self.x, self.y, self.id, Date.now());
    this.systemTo(client, `Dropped ${qty}× ${def.name}.`);
  }

  /** /kick <name> — force-disconnect a player by display name. */
  private gmKick(client: Client, args: string[]): void {
    const name = args[0];
    if (!name) {
      this.systemTo(client, "Usage: /kick <name>");
      return;
    }
    const target = this.findPlayer(name);
    if (!target) {
      this.systemTo(client, `No player named "${name}".`);
      return;
    }
    this.systemTo(client, `Kicked ${target.player.name}.`);
    // 4000 = app-defined consented close code ("kicked by a GM").
    this.clients.find((c) => c.sessionId === target.sessionId)?.leave(4000);
  }

  /** Find an online player by display name (case-insensitive). */
  private findPlayer(name: string): { sessionId: string; player: PlayerSchema } | null {
    const want = name.trim().toLowerCase();
    let found: { sessionId: string; player: PlayerSchema } | null = null;
    this.state.players.forEach((p, sid) => {
      if (!found && p.name.trim().toLowerCase() === want) found = { sessionId: sid, player: p };
    });
    return found;
  }

  /** Push the owner their current inventory (private — never broadcast). */
  private sendInventory(client: Client): void {
    const payload: InventoryPayload = { slots: this.inventories.get(client.sessionId) ?? [] };
    client.send(ServerMessage.Inventory, payload);
  }

  /** Push the owner their current equipped gear (private — never broadcast). */
  private sendEquipment(client: Client): void {
    const payload: EquipmentPayload = { equipment: this.equipment.get(client.sessionId) ?? {} };
    client.send(ServerMessage.Equipment, payload);
  }

  /** Push bank contents to the owner — only while they're standing at a bank. */
  private sendBankIfNear(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || !nearBank(this.map.id, player.x, player.y)) return;
    this.sendBank(client);
  }

  private sendBank(client: Client): void {
    const payload: BankPayload = { slots: this.banks.get(client.sessionId) ?? [] };
    client.send(ServerMessage.Bank, payload);
  }

  /** Deposit/withdraw between bag and bank — only while at a bank. Bag↔bank is
   *  a transfer (no item created/destroyed), so it is NOT ledgered. */
  private handleBankMove(client: Client, msg: BankMovePayload, dir: "deposit" | "withdraw"): void {
    const sessionId = client.sessionId;
    const player = this.state.players.get(sessionId);
    if (!player || !player.alive) return;
    if (!nearBank(this.map.id, player.x, player.y)) return; // must be at a bank
    const def = itemDef(msg.itemId);
    if (!def) return;
    const inv = this.inventories.get(sessionId) ?? [];
    const bank = this.banks.get(sessionId) ?? [];
    const res =
      dir === "deposit"
        ? deposit(inv, bank, def.id, msg.qty, def.maxStack)
        : withdraw(inv, bank, def.id, msg.qty, def.maxStack);
    if (res.moved <= 0) return;
    this.inventories.set(sessionId, res.inventory);
    this.banks.set(sessionId, res.bank);
    this.sendInventory(client);
    this.sendBank(client);
  }

  /** Equip an item from the bag (server-authoritative; recomputes maxHp). */
  private handleEquip(client: Client, msg: EquipPayload): void {
    const sessionId = client.sessionId;
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const res = equip(
      this.inventories.get(sessionId) ?? [],
      this.equipment.get(sessionId) ?? {},
      msg.itemId,
      itemDef,
    );
    if (!res.ok) return;
    this.inventories.set(sessionId, res.inventory);
    this.equipment.set(sessionId, res.equipment);
    this.applyMaxHp(sessionId, player);
    this.sendInventory(client);
    this.sendEquipment(client);
  }

  /** Unequip a slot back into the bag (recomputes maxHp). */
  private handleUnequip(client: Client, msg: UnequipPayload): void {
    const sessionId = client.sessionId;
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const res = unequip(
      this.inventories.get(sessionId) ?? [],
      this.equipment.get(sessionId) ?? {},
      msg.slot,
      itemDef,
    );
    if (!res.ok) return;
    this.inventories.set(sessionId, res.inventory);
    this.equipment.set(sessionId, res.equipment);
    this.applyMaxHp(sessionId, player);
    this.sendInventory(client);
    this.sendEquipment(client);
  }

  /** Pick up a ground-loot pile into the bag (range + ownership checked). */
  private handlePickup(client: Client, msg: PickupPayload): void {
    const sessionId = client.sessionId;
    const player = this.state.players.get(sessionId);
    if (!player || !player.alive) return;
    const loot = this.state.loot.get(msg.lootId);
    if (!loot) return;
    if (distSq(player.x, player.y, loot.x, loot.y) > PICKUP_RANGE * PICKUP_RANGE) return;
    // Reserved to its owner until the timer lapses, then anyone may grab it.
    if (loot.ownerId && loot.ownerId !== player.id && Date.now() < loot.ownerUntil) return;

    const def = itemDef(loot.itemId);
    if (!def) {
      this.state.loot.delete(msg.lootId); // unknown item — clean it up
      this.lootDespawn.delete(msg.lootId);
      return;
    }
    const res = addItem(this.inventories.get(sessionId) ?? [], loot.itemId, loot.qty, def.maxStack);
    if (res.added <= 0) return; // bag full — leave it on the ground
    this.inventories.set(sessionId, res.inventory);
    // Item enters the economy here (kit rule #6): created into a player's bag.
    void recordLedger({ account: player.id, itemId: loot.itemId, delta: res.added, reason: "loot" });
    if (res.added >= loot.qty) {
      this.state.loot.delete(msg.lootId);
      this.lootDespawn.delete(msg.lootId);
    } else {
      loot.qty -= res.added; // partial pickup (bag nearly full) — remainder stays
    }
    this.sendInventory(client);
  }

  /** A player's combat stats: level-derived base + equipped-gear bonuses. The
   *  gear maxHp bonus is already baked into player.maxHp (see applyMaxHp). */
  private playerStats(sessionId: string, player: PlayerSchema): CombatStats {
    const base = combatStatsFromLevel(player.level, player.hp, player.maxHp);
    const bonus = equipmentBonus(this.equipment.get(sessionId) ?? {}, itemDef);
    base.attack += bonus.attack;
    base.strength += bonus.strength;
    base.defence += bonus.defence;
    return base;
  }

  /** Target maxHp for a session: Vitality curve + equipped-gear maxHp bonus. */
  private maxHpFor(sessionId: string, player: PlayerSchema): number {
    return (
      maxHpForVitality(levelForXp(player.vitalityXp)) +
      equipmentBonus(this.equipment.get(sessionId) ?? {}, itemDef).maxHp
    );
  }

  /** Recompute maxHp after a gear change, clamping current hp to the new cap. */
  private applyMaxHp(sessionId: string, player: PlayerSchema): void {
    const newMax = this.maxHpFor(sessionId, player);
    if (newMax === player.maxHp) return;
    player.maxHp = newMax;
    if (player.hp > newMax) player.hp = newMax;
  }

  /** Send a private "System" line to one client (reuses the chat UI). */
  private systemTo(client: Client, text: string): void {
    const payload: ChatBroadcastPayload = {
      channel: "zone",
      from: "System",
      zone: this.map.id,
      text,
      at: Date.now(),
    };
    client.send(ServerMessage.Chat, payload);
  }

  private update(deltaMs: number): void {
    const dt = deltaMs / 1000;

    // Integrate movement + regen energy for every player.
    this.state.players.forEach((player, sessionId) => {
      if (player.energy < player.maxEnergy) {
        const e = Math.min(player.maxEnergy, player.energy + ENERGY_REGEN_PER_SEC * dt);
        if (e !== player.energy) player.energy = e;
      }
      if (!player.alive) return;
      const input = this.inputs.get(sessionId);
      if (!input || (input.dx === 0 && input.dy === 0)) return;
      const next = stepWithCollision(
        { x: player.x, y: player.y },
        { dx: input.dx, dy: input.dy },
        dt,
        MOVE_SPEED,
        this.map.collision,
        PLAYER_HALF,
      );
      player.x = next.x;
      player.y = next.y;
    });

    // Zone exits: stepping onto a gate hands the player off to another zone.
    // We only signal; the client leaves and re-joins the target zone's room.
    this.state.players.forEach((player, sessionId) => {
      if (this.transferring.has(sessionId)) return;
      const exit = exitAt(this.map, player.x, player.y);
      if (!exit) return;
      this.transferring.add(sessionId);
      const payload: TransferPayload = { zone: exit.to, entry: exit.entry };
      this.clients.find((c) => c.sessionId === sessionId)?.send(ServerMessage.Transfer, payload);
    });

    const now = Date.now();

    // Mob AI: aggro the nearest player, chase, attack on cadence, leash home.
    this.state.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      this.updateMob(enemy, dt, now);
    });

    // Respawn dead players at their zone's default entry.
    this.state.players.forEach((player, sessionId) => {
      if (player.alive) return;
      const at = this.deadUntil.get(sessionId);
      if (at !== undefined && now >= at) {
        const entry = this.map.entries["default"]!;
        player.x = entry.x;
        player.y = entry.y;
        player.hp = player.maxHp;
        player.energy = player.maxEnergy;
        player.alive = true;
        this.deadUntil.delete(sessionId);
      }
    });

    // Respawn any dead enemy whose timer has elapsed (back at its home).
    this.state.enemies.forEach((enemy) => {
      if (!enemy.alive && enemy.respawnAt > 0 && now >= enemy.respawnAt) {
        enemy.hp = enemy.maxHp;
        enemy.alive = true;
        enemy.respawnAt = 0;
        this.mobContributors.get(enemy.id)?.clear(); // fresh life, fresh credit
        const ai = this.enemyAI.get(enemy.id);
        if (ai) {
          enemy.x = ai.homeX;
          enemy.y = ai.homeY;
          ai.target = null;
          ai.lastAttackAt = 0;
        }
      }
    });

    // Despawn ground loot whose timer has elapsed (unpicked loot is a non-event
    // for the ledger — nothing entered a player's inventory).
    this.state.loot.forEach((_loot, id) => {
      const at = this.lootDespawn.get(id);
      if (at !== undefined && now >= at) {
        this.state.loot.delete(id);
        this.lootDespawn.delete(id);
      }
    });
  }

  /** One mob's behavior for a tick: acquire/keep a target, chase, attack, leash. */
  private updateMob(enemy: EnemySchema, dt: number, now: number): void {
    const def = mobDef(enemy.kind);
    if (def.aggroRadius <= 0) return; // passive (training dummy)
    const ai = this.enemyAI.get(enemy.id);
    if (!ai) return;

    const homeDist = Math.hypot(enemy.x - ai.homeX, enemy.y - ai.homeY);

    // Drop a target that died, left, wandered out of leash, or pulled us too far.
    let target = ai.target ? this.state.players.get(ai.target) : undefined;
    if (
      target &&
      (!target.alive ||
        homeDist > def.leashRadius ||
        Math.hypot(enemy.x - target.x, enemy.y - target.y) > def.leashRadius)
    ) {
      target = undefined;
      ai.target = null;
    }

    // Acquire the nearest in-range living player (only while near home).
    if (!target && homeDist <= def.leashRadius) {
      let bestDist = def.aggroRadius;
      this.state.players.forEach((p, sid) => {
        if (!p.alive) return;
        const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        if (d <= bestDist) {
          bestDist = d;
          target = p;
          ai.target = sid;
        }
      });
    }

    if (target && ai.target) {
      const d = Math.hypot(enemy.x - target.x, enemy.y - target.y);
      if (d > def.attackRange) {
        this.moveToward(enemy, target.x, target.y, def.moveSpeed, dt);
      } else if (now - ai.lastAttackAt >= def.attackCooldownMs) {
        ai.lastAttackAt = now;
        const result = resolveAttack(mobCombatStats(enemy), this.playerStats(ai.target, target));
        if (result.hit) {
          target.hp = result.targetHpAfter;
          const evt: CombatEventPayload = {
            attackerId: enemy.id,
            targetId: ai.target,
            damage: result.damage,
            targetDied: result.targetDied,
          };
          this.broadcast(ServerMessage.CombatEvent, evt);
          if (result.targetDied) this.killPlayer(target, ai.target, now);
        }
      }
    } else if (homeDist > 4) {
      this.moveToward(enemy, ai.homeX, ai.homeY, def.moveSpeed, dt); // drift home
    }
  }

  private moveToward(enemy: EnemySchema, tx: number, ty: number, speed: number, dt: number): void {
    const next = stepWithCollision(
      { x: enemy.x, y: enemy.y },
      { dx: tx - enemy.x, dy: ty - enemy.y },
      dt,
      speed,
      this.map.collision,
      ENEMY_HALF,
    );
    enemy.x = next.x;
    enemy.y = next.y;
  }

  /** Mark a player slain: stop them, schedule respawn, drop mob aggro on them. */
  private killPlayer(player: PlayerSchema, sessionId: string, now: number): void {
    player.alive = false;
    player.hp = 0;
    this.deadUntil.set(sessionId, now + PLAYER_RESPAWN_MS);
    const input = this.inputs.get(sessionId);
    if (input) {
      input.dx = 0;
      input.dy = 0;
    }
    this.enemyAI.forEach((ai) => {
      if (ai.target === sessionId) ai.target = null;
    });
  }

  private async snapshotAll(): Promise<void> {
    const snapshots: SavedCharacter[] = [];
    this.state.players.forEach((player, sessionId) =>
      snapshots.push(
        toSaved(
          player,
          this.map.id,
          this.inventories.get(sessionId) ?? [],
          this.equipment.get(sessionId) ?? {},
          this.banks.get(sessionId) ?? [],
        ),
      ),
    );
    const results = await Promise.allSettled(snapshots.map((s) => characterStore.save(s)));
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r?.status === "rejected") {
        console.error(`[zone] snapshot failed for ${snapshots[i]?.playerId}:`, r.reason);
      }
    }
  }
}

// --- pure helpers ----------------------------------------------------------

function mobCombatStats(enemy: EnemySchema): CombatStats {
  const d = mobDef(enemy.kind);
  return {
    attack: d.attack,
    strength: d.strength,
    defence: d.defence,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    alive: enemy.alive,
  };
}

function toSaved(
  p: PlayerSchema,
  zone: string,
  inventory: Inventory,
  equipment: Equipment,
  bank: Bank,
): SavedCharacter {
  return {
    playerId: p.id,
    name: p.name,
    zone,
    x: p.x,
    y: p.y,
    hp: p.hp,
    maxHp: p.maxHp,
    level: p.level,
    meleeXp: p.meleeXp,
    vitalityXp: p.vitalityXp,
    inventory,
    equipment,
    bank,
  };
}
