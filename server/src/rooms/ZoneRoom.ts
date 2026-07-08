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
  GATHER_RANGE,
  TALK_RANGE,
  distSq,
  type CombatEventPayload,
  type JoinZoneOptions,
  type MovePayload,
  type UseAbilityPayload,
  type WelcomePayload,
  type TransferPayload,
  type ChatPayload,
  type ChatBroadcastPayload,
  type WhisperPayload,
  type LevelUpPayload,
  type SkillId,
  type InventoryPayload,
  type EquipPayload,
  type UnequipPayload,
  type EquipmentPayload,
  type PickupPayload,
  type BankMovePayload,
  type BankPayload,
  type GatherPayload,
  type CraftPayload,
  type ConsumePayload,
  type QuestActionPayload,
  type QuestsPayload,
  type TalkPayload,
  type TradePayload,
  type FriendActionPayload,
  type FriendsPayload,
  type FriendEntry,
  type PartyInvitePayload,
  type PartyPayload,
  type PartyMemberEntry,
  type GuildCreatePayload,
  type GuildActionPayload,
  type GuildSetRankPayload,
  type GuildPayload,
  type GuildMemberEntry,
  FRIENDS_MAX,
  PARTY_MAX,
  PARTY_LEVEL_RANGE,
} from "@mmo/shared";
import {
  validGuildName,
  validGuildTag,
  canKick,
  canSetRank,
  GUILD_MEMBERS_MAX,
  type GuildRank,
} from "@mmo/shared/systems/guild";
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
import {
  equip,
  unequip,
  equipmentBonus,
  type Equipment,
} from "@mmo/shared/systems/equipment";
import { deposit, withdraw, type Bank } from "@mmo/shared/systems/bank";
import { itemDef, ITEM_IDS } from "@mmo/shared/data/items";
import { nearBank } from "@mmo/shared/data/banks";
import { resourceNode } from "@mmo/shared/data/resources";
import { recipeDef } from "@mmo/shared/data/recipes";
import { questDef } from "@mmo/shared/data/quests";
import { npcDef } from "@mmo/shared/data/npcs";
import { vendorDef } from "@mmo/shared/data/vendors";
import { EnemySchema, PlayerSchema, ZoneState, GroundLootSchema } from "@mmo/shared/schema/state";
import {
  MoveSchema,
  UseAbilitySchema,
  ChatSchema,
  WhisperSchema,
  EquipSchema,
  UnequipSchema,
  PickupSchema,
  BankMoveSchema,
  GatherSchema,
  CraftSchema,
  ConsumeSchema,
  QuestActionSchema,
  TalkSchema,
  TradeSchema,
  FriendActionSchema,
  PartyInviteSchema,
  GuildCreateSchema,
  GuildActionSchema,
  GuildSetRankSchema,
} from "@mmo/shared/protocol/schemas";
import { rollDrops } from "@mmo/shared/systems/loot";
import { stepWithCollision, isBoxFree } from "@mmo/shared/systems/collision";
import { resolveAttack, type CombatStats } from "@mmo/shared/systems/combatmath";
import {
  combatStatsFromLevel,
  gainXp,
  levelForXp,
  maxHpForVitality,
  restedBonus,
} from "@mmo/shared/systems/progression";
import {
  ZONES,
  DEFAULT_ZONE,
  isZoneId,
  isDungeonId,
  mapForId,
  type ZoneId,
} from "@mmo/shared/data/zones";
import { mobDef, MOBS } from "@mmo/shared/data/mobs";
import { exitAt, type ZoneMap } from "@mmo/shared/systems/zonemap";
import { RateLimiter } from "@mmo/shared/systems/ratelimit";
import { parseCommand, isGm, parseGmAllowlist, type GmCommand } from "@mmo/shared/systems/gm";
import { verifyToken } from "../auth";
import { censorText } from "../chat";
import { globalBus } from "../services/globalBus";
import { presence } from "../services/presence";
import { parties } from "../services/party";
import { dungeons } from "../services/dungeons";
import { guildInvites } from "../services/guildInvites";
import {
  createGuild,
  getGuild,
  listGuildMembers,
  setMembership,
  membershipOf,
  removeMember,
} from "../persistence/guilds";
import { characterStore, type SavedCharacter } from "../persistence/store";
import { recordLedger } from "../persistence/ledger";

const SNAPSHOT_INTERVAL_MS = 15_000;
const PLAYER_HALF = 12; // half-extent of a player's collision box, world units
const ENEMY_HALF = 12; // half-extent of a mob's collision box
const PLAYER_RESPAWN_MS = 5000; // delay before a slain player respawns
/** Fraction of a kill's melee XP that also feeds Vitality (HP) growth. */
const VITALITY_XP_FRACTION = 1 / 3;

/** The non-combat skills (gathering + crafting) — XP-only, no combat effects. */
type NonCombatSkill = "mining" | "fishing" | "smithing" | "cooking";

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
  /** Unsubscribe handle for the whisper bus (set in onCreate). */
  private unsubscribeWhisper?: () => void;
  /** Unsubscribe handle for party-roster changes (set in onCreate). */
  private unsubscribeParty?: () => void;
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
  /** Per-session active gather: which node, and when the current yield lands. */
  private readonly gatherState = new Map<string, { nodeId: string; finishAt: number }>();
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
  /** Authoritative per-session quest log (off synced state, persisted). */
  private readonly questLogs = new Map<string, QuestLog>();
  /** Authoritative per-session friends list (off synced state, persisted). */
  private readonly friendLists = new Map<string, string[]>();
  /** Per-session guild membership cache (DB is the source of truth). */
  private readonly guildCache = new Map<string, { guildId: string; rank: GuildRank } | null>();
  /** Unsubscribe handles for the guild buses (set in onCreate). */
  private unsubscribeGuildChat?: () => void;
  private unsubscribeGuildChanged?: () => void;
  /** For an instanced dungeon room: the overworld zone its players return to
   *  (persisted instead of the dungeon id, so a relog is never stranded). */
  private returnZone?: ZoneId;

  override onCreate(options?: { zoneId?: string }): void {
    this.map = mapForId(options?.zoneId ?? "") ?? ZONES[DEFAULT_ZONE];

    // A dungeon is an instanced room: cap it at a party and remember where its
    // players return to, so persistence never strands them in a dead instance.
    if (isDungeonId(this.map.id)) {
      this.maxClients = PARTY_MAX;
      const back = this.map.exits[0]?.to;
      this.returnZone = back && isZoneId(back) ? back : DEFAULT_ZONE;
    }

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
      this.sendQuests(client);
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

    this.onMessage(ClientMessage.Gather, GatherSchema, (client, msg: GatherPayload) => {
      this.handleGather(client, msg);
    });

    this.onMessage(ClientMessage.Craft, CraftSchema, (client, msg: CraftPayload) => {
      this.handleCraft(client, msg);
    });

    this.onMessage(ClientMessage.Consume, ConsumeSchema, (client, msg: ConsumePayload) => {
      this.handleConsume(client, msg);
    });

    this.onMessage(ClientMessage.QuestAccept, QuestActionSchema, (client, msg: QuestActionPayload) => {
      this.handleQuestAccept(client, msg);
    });

    this.onMessage(ClientMessage.QuestComplete, QuestActionSchema, (client, msg: QuestActionPayload) => {
      this.handleQuestComplete(client, msg);
    });

    this.onMessage(ClientMessage.Talk, TalkSchema, (client, msg: TalkPayload) => {
      this.handleTalk(client, msg);
    });

    this.onMessage(ClientMessage.Buy, TradeSchema, (client, msg: TradePayload) => {
      this.handleBuy(client, msg);
    });

    this.onMessage(ClientMessage.Sell, TradeSchema, (client, msg: TradePayload) => {
      this.handleSell(client, msg);
    });

    this.onMessage(ClientMessage.Whisper, WhisperSchema, (client, msg: WhisperPayload) => {
      this.handleWhisper(client, msg);
    });

    this.onMessage(ClientMessage.FriendAdd, FriendActionSchema, (client, msg: FriendActionPayload) => {
      void this.handleFriendAdd(client, msg);
    });

    this.onMessage(ClientMessage.FriendRemove, FriendActionSchema, (client, msg: FriendActionPayload) => {
      this.handleFriendRemove(client, msg);
    });

    this.onMessage(ClientMessage.RequestFriends, (client) => this.sendFriends(client));

    this.onMessage(ClientMessage.PartyInvite, PartyInviteSchema, (client, msg: PartyInvitePayload) => {
      this.handlePartyInvite(client, msg);
    });
    this.onMessage(ClientMessage.PartyAccept, (client) => this.handlePartyAccept(client));
    this.onMessage(ClientMessage.PartyLeave, (client) => this.handlePartyLeave(client));
    this.onMessage(ClientMessage.RequestParty, (client) => this.sendParty(client));

    this.onMessage(ClientMessage.GuildCreate, GuildCreateSchema, (client, msg: GuildCreatePayload) => {
      void this.handleGuildCreate(client, msg);
    });
    this.onMessage(ClientMessage.GuildInvite, GuildActionSchema, (client, msg: GuildActionPayload) => {
      void this.handleGuildInvite(client, msg);
    });
    this.onMessage(ClientMessage.GuildAccept, (client) => {
      void this.handleGuildAccept(client);
    });
    this.onMessage(ClientMessage.GuildLeave, (client) => {
      void this.handleGuildLeave(client);
    });
    this.onMessage(ClientMessage.GuildKick, GuildActionSchema, (client, msg: GuildActionPayload) => {
      void this.handleGuildKick(client, msg);
    });
    this.onMessage(ClientMessage.GuildSetRank, GuildSetRankSchema, (client, msg: GuildSetRankPayload) => {
      void this.handleGuildSetRank(client, msg);
    });
    this.onMessage(ClientMessage.RequestGuild, (client) => {
      void this.sendGuild(client);
    });

    // Global chat arrives from any zone in this process — fan it out to ours.
    this.unsubscribeGlobal = globalBus.onChat((payload) => {
      this.broadcast(ServerMessage.Chat, payload);
    });

    // Whispers arrive from any zone — deliver to the named recipient if they're
    // in this room.
    this.unsubscribeWhisper = globalBus.onWhisper((payload) => {
      if (payload.to) this.deliverWhisperTo(payload.to, payload);
    });

    // Party rosters changed somewhere — refresh any affected player we hold.
    this.unsubscribeParty = globalBus.onPartyChanged((names) => {
      const wanted = new Set(names.map((n) => n.trim().toLowerCase()));
      this.state.players.forEach((p, sid) => {
        if (!wanted.has(p.name.trim().toLowerCase())) return;
        const client = this.clients.find((c) => c.sessionId === sid);
        if (client) this.sendParty(client);
      });
    });

    // Guild chat: deliver to every session in this room belonging to the guild.
    this.unsubscribeGuildChat = globalBus.onGuildChat((guildId, payload) => {
      this.guildCache.forEach((membership, sid) => {
        if (membership?.guildId !== guildId) return;
        this.clients.find((c) => c.sessionId === sid)?.send(ServerMessage.Chat, payload);
      });
    });

    // Guild state changed for these players — re-read the DB and push.
    this.unsubscribeGuildChanged = globalBus.onGuildChanged((names) => {
      const wanted = new Set(names.map((n) => n.trim().toLowerCase()));
      this.state.players.forEach((p, sid) => {
        if (!wanted.has(p.name.trim().toLowerCase())) return;
        const client = this.clients.find((c) => c.sessionId === sid);
        if (client) void this.refreshGuild(client, p.id);
      });
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

    // A dungeon instance only admits players its ticket names — the random
    // ticket both routes to the right instance (filterBy) and gates entry, so
    // a stray or copied ticket can't slip a stranger into someone's run.
    if (isDungeonId(this.map.id) && !dungeons.allows(options?.ticket ?? "", name)) {
      throw new ServerError(403, "This dungeon instance isn't yours to enter.");
    }

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
    player.miningXp = saved.miningXp;
    player.fishingXp = saved.fishingXp;
    player.smithingXp = saved.smithingXp;
    player.cookingXp = saved.cookingXp;
    player.restedXp = saved.restedXp;
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
    this.questLogs.set(client.sessionId, saved.quests);
    this.friendLists.set(client.sessionId, saved.friends);
    this.guildCache.set(
      client.sessionId,
      saved.guildId ? { guildId: saved.guildId, rank: (saved.guildRank ?? "member") as GuildRank } : null,
    );
    presence.register(saved.name, this.map.id);
    this.sendInventory(client);
    this.sendEquipment(client);
    this.sendQuests(client);
    this.sendParty(client);
    void this.sendGuild(client);

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
    this.gatherState.delete(client.sessionId);
    this.gmSessions.delete(client.sessionId);
    this.enemyAI.forEach((ai) => {
      if (ai.target === client.sessionId) ai.target = null;
    });
    this.mobContributors.forEach((set) => set.delete(client.sessionId));
    const inventory = this.inventories.get(client.sessionId) ?? [];
    const equipment = this.equipment.get(client.sessionId) ?? {};
    const bank = this.banks.get(client.sessionId) ?? [];
    const quests = this.questLogs.get(client.sessionId) ?? [];
    const friends = this.friendLists.get(client.sessionId) ?? [];
    this.inventories.delete(client.sessionId);
    this.equipment.delete(client.sessionId);
    this.banks.delete(client.sessionId);
    this.questLogs.delete(client.sessionId);
    this.friendLists.delete(client.sessionId);
    this.guildCache.delete(client.sessionId);
    if (!player) return;

    // Unregister presence — but only if we still own the entry (on a zone
    // transfer the destination room may have already re-registered them).
    if (presence.get(player.name)?.zone === this.map.id) presence.unregister(player.name);

    const snapshot = this.finalizeSnapshot(
      toSaved(player, this.map.id, inventory, equipment, bank, quests, friends),
    );
    this.state.players.delete(client.sessionId);
    try {
      await characterStore.save(snapshot);
    } catch (err) {
      console.error(`[zone] failed to save ${snapshot.playerId} on leave:`, err);
    }
  }

  override async onDispose(): Promise<void> {
    this.unsubscribeGlobal?.();
    this.unsubscribeWhisper?.();
    this.unsubscribeParty?.();
    this.unsubscribeGuildChat?.();
    this.unsubscribeGuildChanged?.();
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
    // Party XP: contributors' party members in this zone (alive, within the
    // level range) share kill credit even without tagging the mob. Loot rolls
    // stay tag-based — only real damage earns a personal drop.
    const credited = new Set(contributors);
    contributors.forEach((sessionId) => {
      const tagger = this.state.players.get(sessionId);
      if (!tagger) return;
      const party = parties.partyOf(tagger.name);
      if (!party) return;
      const memberKeys = new Set(party.members.map((m) => m.trim().toLowerCase()));
      this.state.players.forEach((cand, candSid) => {
        if (credited.has(candSid) || !cand.alive) return;
        if (!memberKeys.has(cand.name.trim().toLowerCase())) return;
        if (Math.abs(cand.level - tagger.level) > PARTY_LEVEL_RANGE) return;
        credited.add(candSid);
      });
    });

    // GW2-style: every credited player gets XP; every TAGGER gets a loot roll.
    credited.forEach((sessionId) => {
      const player = this.state.players.get(sessionId);
      if (!player) return;
      this.grantXp(sessionId, player, meleeAmt, vitalityAmt);
      if (contributors.has(sessionId)) {
        for (const stack of rollDrops(def.drops)) {
          this.spawnLoot(stack.itemId, stack.qty, enemy.x, enemy.y, player.id, now);
        }
      }
      // Advance any "kill" quest objectives for this mob kind.
      const log = this.questLogs.get(sessionId);
      if (log) {
        const next = recordKill(log, enemy.kind, questDef);
        if (next !== log) {
          this.questLogs.set(sessionId, next);
          const client = this.clients.find((c) => c.sessionId === sessionId);
          if (client) this.sendQuests(client);
        }
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
    const melee = gainXp(player.meleeXp, this.withRested(player, meleeAmt));
    player.meleeXp = melee.xp;
    player.level = melee.level; // keep level == melee level even without a tick-up
    if (melee.leveledUp) this.sendLevelUp(sessionId, "melee", melee.level);

    const vitality = gainXp(player.vitalityXp, this.withRested(player, vitalityAmt));
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
    } else if (msg.channel === "guild") {
      const membership = this.guildCache.get(client.sessionId);
      if (!membership) {
        this.systemTo(client, "You're not in a guild.");
        return;
      }
      globalBus.publishGuildChat(membership.guildId, payload); // members-only fan-out
    } else {
      this.broadcast(ServerMessage.Chat, payload);
    }
  }

  /** Send a private message: echo to the sender + route to the recipient. */
  private handleWhisper(client: Client, msg: WhisperPayload): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (!this.chatLimiter.allow(client.sessionId)) return; // shares the chat throttle
    const text = censorText(msg.text).trim().slice(0, 200);
    const to = msg.to.trim().slice(0, 24);
    if (!text || !to) return;

    const payload: ChatBroadcastPayload = {
      channel: "whisper",
      from: player.name,
      to,
      zone: this.map.id,
      text,
      at: Date.now(),
    };
    client.send(ServerMessage.Chat, payload); // the sender's own copy
    globalBus.publishWhisper(payload); // delivered by whichever room holds `to`
  }

  /** Deliver a whisper to a recipient by display name, if they're in this room. */
  private deliverWhisperTo(name: string, payload: ChatBroadcastPayload): void {
    const want = name.trim().toLowerCase();
    this.state.players.forEach((p, sid) => {
      if (p.name.trim().toLowerCase() !== want) return;
      this.clients.find((c) => c.sessionId === sid)?.send(ServerMessage.Chat, payload);
    });
  }

  // --- friends ----------------------------------------------------------------

  /** Push the owner their friends list with live presence. */
  private sendFriends(client: Client): void {
    const names = this.friendLists.get(client.sessionId) ?? [];
    const friends: FriendEntry[] = names.map((name) => {
      const p = presence.get(name);
      return p ? { name, online: true, zone: p.zone } : { name, online: false };
    });
    const payload: FriendsPayload = { friends };
    client.send(ServerMessage.Friends, payload);
  }

  /** Add a friend by display name (must be a real character; capped; deduped). */
  private async handleFriendAdd(client: Client, msg: FriendActionPayload): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const name = msg.name.trim();
    if (!name || name.toLowerCase() === player.name.trim().toLowerCase()) return; // not yourself
    const list = this.friendLists.get(client.sessionId) ?? [];
    if (list.length >= FRIENDS_MAX) {
      this.systemTo(client, "Your friends list is full.");
      return;
    }
    if (list.some((n) => n.toLowerCase() === name.toLowerCase())) return; // already added
    if (!(await characterStore.nameExists(name))) {
      this.systemTo(client, `No character named "${name}".`);
      return;
    }
    // Re-fetch after the await — the session may have changed/left meanwhile.
    const fresh = this.friendLists.get(client.sessionId);
    if (!fresh || fresh.length >= FRIENDS_MAX) return;
    this.friendLists.set(client.sessionId, [...fresh, name]);
    this.sendFriends(client);
  }

  /** Remove a name from the friends list (case-insensitive). */
  private handleFriendRemove(client: Client, msg: FriendActionPayload): void {
    const list = this.friendLists.get(client.sessionId);
    if (!list) return;
    const want = msg.name.trim().toLowerCase();
    const next = list.filter((n) => n.toLowerCase() !== want);
    if (next.length === list.length) return;
    this.friendLists.set(client.sessionId, next);
    this.sendFriends(client);
  }

  // --- parties ----------------------------------------------------------------

  /** Push the owner their party roster (with presence) + any pending invite. */
  private sendParty(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const party = parties.partyOf(player.name);
    const members: PartyMemberEntry[] = (party?.members ?? []).map((name) => {
      const p = presence.get(name);
      return {
        name,
        leader: party!.leader.trim().toLowerCase() === name.trim().toLowerCase(),
        online: !!p,
        ...(p ? { zone: p.zone } : {}),
      };
    });
    const invitedBy = parties.inviteFor(player.name);
    const payload: PartyPayload = { members, ...(invitedBy ? { invitedBy } : {}) };
    client.send(ServerMessage.Party, payload);
  }

  /** Invite an online player to the party (transient — recipient must be on). */
  private handlePartyInvite(client: Client, msg: PartyInvitePayload): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const target = presence.get(msg.name);
    if (!target) {
      this.systemTo(client, `${msg.name} isn't online.`);
      return;
    }
    const result = parties.invite(player.name, target.name);
    if (result === "invitee_in_party") {
      this.systemTo(client, `${target.name} is already in a party.`);
      return;
    }
    if (result === "party_full") {
      this.systemTo(client, "Your party is full.");
      return;
    }
    if (result !== "ok") return;
    this.systemTo(client, `Invited ${target.name} to your party.`);
    // Tell the invitee (System whisper reaches them in any zone) + refresh
    // their party panel so the Accept button appears.
    globalBus.publishWhisper({
      channel: "whisper",
      from: "System",
      to: target.name,
      zone: this.map.id,
      text: `${player.name} invited you to a party. Open the party panel (P) to accept.`,
      at: Date.now(),
    });
    globalBus.publishPartyChanged([target.name]);
  }

  private handlePartyAccept(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const inviter = parties.inviteFor(player.name);
    const result = parties.accept(player.name);
    if (result !== "ok") {
      if (result === "party_full") this.systemTo(client, "That party is now full.");
      this.sendParty(client); // clears a stale invite in the UI
      return;
    }
    const party = parties.partyOf(player.name);
    globalBus.publishPartyChanged(party ? party.members : [player.name, inviter ?? ""]);
  }

  private handlePartyLeave(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const affected = parties.leave(player.name);
    if (affected.length > 0) globalBus.publishPartyChanged(affected);
  }

  // --- guilds -----------------------------------------------------------------

  /** Re-read membership from the DB into the cache, then push guild state. */
  private async refreshGuild(client: Client, accountId: string): Promise<void> {
    const membership = await membershipOf(accountId);
    this.guildCache.set(client.sessionId, membership);
    await this.sendGuild(client);
  }

  /** Push the owner their guild roster (with presence) or pending invite. */
  private async sendGuild(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const membership = this.guildCache.get(client.sessionId);
    if (!membership) {
      const invite = guildInvites.get(player.name);
      const payload: GuildPayload = {
        members: [],
        ...(invite ? { invitedTo: { guildName: invite.guildName, by: invite.inviterName } } : {}),
      };
      client.send(ServerMessage.Guild, payload);
      return;
    }
    const [guild, rows] = await Promise.all([
      getGuild(membership.guildId),
      listGuildMembers(membership.guildId),
    ]);
    if (!guild) {
      // Guild vanished (disband raced us) — clear and resend as guildless.
      this.guildCache.set(client.sessionId, null);
      client.send(ServerMessage.Guild, { members: [] } satisfies GuildPayload);
      return;
    }
    const members: GuildMemberEntry[] = rows.map((m) => {
      const p = presence.get(m.name);
      return { name: m.name, rank: m.rank, online: !!p, ...(p ? { zone: p.zone } : {}) };
    });
    const payload: GuildPayload = {
      name: guild.name,
      tag: guild.tag,
      myRank: membership.rank,
      members,
    };
    client.send(ServerMessage.Guild, payload);
  }

  /** Found a guild (validated name/tag; founder becomes leader). */
  private async handleGuildCreate(client: Client, msg: GuildCreatePayload): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (this.guildCache.get(client.sessionId)) {
      this.systemTo(client, "You're already in a guild.");
      return;
    }
    if (!validGuildName(msg.name) || !validGuildTag(msg.tag)) {
      this.systemTo(client, "Guild name must be 3-24 characters; tag 2-4 letters/numbers.");
      return;
    }
    const result = await createGuild(player.id, msg.name, msg.tag);
    if (!result.ok) {
      this.systemTo(client, result.error);
      return;
    }
    await this.refreshGuild(client, player.id);
    this.systemTo(client, `Founded ${result.guild.name} [${result.guild.tag}]!`);
  }

  /** Invite an online player (officer+ only; capped roster). */
  private async handleGuildInvite(client: Client, msg: GuildActionPayload): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    const membership = this.guildCache.get(client.sessionId);
    if (!player || !membership) return;
    if (membership.rank === "member") {
      this.systemTo(client, "Only the leader and officers can invite.");
      return;
    }
    const target = presence.get(msg.name);
    if (!target) {
      this.systemTo(client, `${msg.name} isn't online.`);
      return;
    }
    const guild = await getGuild(membership.guildId);
    if (!guild) return;
    const members = await listGuildMembers(membership.guildId);
    if (members.length >= GUILD_MEMBERS_MAX) {
      this.systemTo(client, "Your guild is full.");
      return;
    }
    if (members.some((m) => m.name.trim().toLowerCase() === target.name.trim().toLowerCase())) {
      this.systemTo(client, `${target.name} is already in your guild.`);
      return;
    }
    guildInvites.set(target.name, {
      guildId: guild.id,
      guildName: guild.name,
      inviterName: player.name,
    });
    this.systemTo(client, `Invited ${target.name} to ${guild.name}.`);
    globalBus.publishWhisper({
      channel: "whisper",
      from: "System",
      to: target.name,
      zone: this.map.id,
      text: `${player.name} invited you to the guild ${guild.name} [${guild.tag}]. Open the guild panel (G) to accept.`,
      at: Date.now(),
    });
    globalBus.publishGuildChanged([target.name]);
  }

  /** Accept the pending guild invite (re-validated against the DB). */
  private async handleGuildAccept(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (this.guildCache.get(client.sessionId)) return; // already in one
    const invite = guildInvites.consume(player.name);
    if (!invite) return;
    const guild = await getGuild(invite.guildId);
    if (!guild) {
      this.systemTo(client, "That guild no longer exists.");
      await this.sendGuild(client);
      return;
    }
    const members = await listGuildMembers(guild.id);
    if (members.length >= GUILD_MEMBERS_MAX) {
      this.systemTo(client, "That guild is now full.");
      await this.sendGuild(client);
      return;
    }
    await setMembership(player.id, guild.id, "member");
    globalBus.publishGuildChanged([player.name, ...members.map((m) => m.name)]);
  }

  /** Leave the guild (leadership hands off; disbands when empty). */
  private async handleGuildLeave(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    const membership = this.guildCache.get(client.sessionId);
    if (!player || !membership) return;
    const affected = await removeMember(membership.guildId, player.id);
    if (affected.length > 0) globalBus.publishGuildChanged(affected);
  }

  /** Kick a member (rank rules from shared/systems/guild). */
  private async handleGuildKick(client: Client, msg: GuildActionPayload): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    const membership = this.guildCache.get(client.sessionId);
    if (!player || !membership) return;
    const members = await listGuildMembers(membership.guildId);
    const target = members.find(
      (m) => m.name.trim().toLowerCase() === msg.name.trim().toLowerCase(),
    );
    if (!target || target.id === player.id) return;
    if (!canKick(membership.rank, target.rank)) {
      this.systemTo(client, "You can't kick that member.");
      return;
    }
    const affected = await removeMember(membership.guildId, target.id);
    if (affected.length > 0) globalBus.publishGuildChanged(affected);
    this.systemTo(client, `Removed ${target.name} from the guild.`);
  }

  /** Promote/demote between officer and member (leader only). */
  private async handleGuildSetRank(client: Client, msg: GuildSetRankPayload): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    const membership = this.guildCache.get(client.sessionId);
    if (!player || !membership) return;
    const members = await listGuildMembers(membership.guildId);
    const target = members.find(
      (m) => m.name.trim().toLowerCase() === msg.name.trim().toLowerCase(),
    );
    if (!target) return;
    if (!canSetRank(membership.rank, target.rank, msg.rank)) {
      this.systemTo(client, "Only the leader can change ranks.");
      return;
    }
    await setMembership(target.id, membership.guildId, msg.rank);
    globalBus.publishGuildChanged(members.map((m) => m.name));
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

  /** Start (or restart) gathering a resource node — server validates each yield
   *  in update(); it auto-repeats while the player stands still in range. */
  private handleGather(client: Client, msg: GatherPayload): void {
    const sessionId = client.sessionId;
    const player = this.state.players.get(sessionId);
    if (!player || !player.alive) return;
    const resolved = resourceNode(this.map.id, msg.nodeId);
    if (!resolved) return;
    const { node, def } = resolved;
    if (distSq(player.x, player.y, node.x, node.y) > GATHER_RANGE * GATHER_RANGE) return;
    if (levelForXp(this.skillXp(player, def.skill)) < def.levelReq) {
      this.systemTo(client, `You need ${def.skill} level ${def.levelReq} for that.`);
      return;
    }
    this.gatherState.set(sessionId, { nodeId: msg.nodeId, finishAt: Date.now() + def.gatherMs });
  }

  /** Current XP in a non-combat (gathering/crafting) skill. */
  private skillXp(player: PlayerSchema, skill: NonCombatSkill): number {
    switch (skill) {
      case "mining":
        return player.miningXp;
      case "fishing":
        return player.fishingXp;
      case "smithing":
        return player.smithingXp;
      case "cooking":
        return player.cookingXp;
    }
  }

  /** Grant XP to a non-combat skill and toast a level-up (no combat-stat side effects). */
  /** Apply the rested-XP bonus to a base award, draining the player's buffer. */
  private withRested(player: PlayerSchema, amount: number): number {
    const bonus = restedBonus(player.restedXp, amount);
    if (bonus > 0) player.restedXp -= bonus;
    return amount + bonus;
  }

  private grantSkillXp(
    sessionId: string,
    player: PlayerSchema,
    skill: NonCombatSkill,
    amount: number,
  ): void {
    const g = gainXp(this.skillXp(player, skill), this.withRested(player, amount));
    switch (skill) {
      case "mining":
        player.miningXp = g.xp;
        break;
      case "fishing":
        player.fishingXp = g.xp;
        break;
      case "smithing":
        player.smithingXp = g.xp;
        break;
      case "cooking":
        player.cookingXp = g.xp;
        break;
    }
    if (g.leveledUp) this.sendLevelUp(sessionId, skill, g.level);
  }

  /** Craft one of a recipe from bag inputs (instant; server-authoritative). */
  private handleCraft(client: Client, msg: CraftPayload): void {
    const sessionId = client.sessionId;
    const player = this.state.players.get(sessionId);
    if (!player || !player.alive) return;
    const recipe = recipeDef(msg.recipeId);
    if (!recipe) return;
    if (levelForXp(this.skillXp(player, recipe.skill)) < recipe.levelReq) {
      this.systemTo(client, `You need ${recipe.skill} level ${recipe.levelReq} for that.`);
      return;
    }
    const inv = this.inventories.get(sessionId) ?? [];
    const res = craft(inv, recipe, itemDef);
    if (!res.ok) {
      this.systemTo(client, "You don't have the materials (or your bag is full).");
      return;
    }
    this.inventories.set(sessionId, res.inventory);
    // Ledger the transformation: inputs destroyed, output created (kit rule #6).
    for (const inp of recipe.inputs) {
      void recordLedger({ account: player.id, itemId: inp.itemId, delta: -inp.qty, reason: "craft" });
    }
    void recordLedger({
      account: player.id,
      itemId: recipe.output.itemId,
      delta: recipe.output.qty,
      reason: "craft",
    });
    this.grantSkillXp(sessionId, player, recipe.skill, recipe.xp);
    this.sendInventory(client);
  }

  /** Eat one of an item to heal (cooked food / potions). */
  private handleConsume(client: Client, msg: ConsumePayload): void {
    const sessionId = client.sessionId;
    const player = this.state.players.get(sessionId);
    if (!player || !player.alive) return;
    const def = itemDef(msg.itemId);
    if (!def || !def.heal || def.heal <= 0) return; // not edible
    const inv = this.inventories.get(sessionId) ?? [];
    const removed = removeItem(inv, msg.itemId, 1);
    if (removed.removed <= 0) return; // none held
    this.inventories.set(sessionId, removed.inventory);
    void recordLedger({ account: player.id, itemId: msg.itemId, delta: -1, reason: "consume" });
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + def.heal);
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
    this.sendInventory(client);
  }

  // --- quests ---------------------------------------------------------------

  /** Push the owner their quest log (private — never broadcast). */
  private sendQuests(client: Client): void {
    const payload: QuestsPayload = { quests: this.questLogs.get(client.sessionId) ?? [] };
    client.send(ServerMessage.Quests, payload);
  }

  /** Accept an available quest (prerequisite + dedupe checked server-side). */
  private handleQuestAccept(client: Client, msg: QuestActionPayload): void {
    const def = questDef(msg.questId);
    if (!def) return;
    const log = this.questLogs.get(client.sessionId) ?? [];
    if (!canAccept(log, def)) return;
    this.questLogs.set(client.sessionId, acceptQuest(log, def));
    this.sendQuests(client);
  }

  /** Turn in a quest whose objectives are met: consume collect items, pay out. */
  private handleQuestComplete(client: Client, msg: QuestActionPayload): void {
    const sessionId = client.sessionId;
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const def = questDef(msg.questId);
    if (!def) return;
    const log = this.questLogs.get(sessionId) ?? [];
    const qp = findQuest(log, msg.questId);
    if (!qp || qp.status !== "active") return;

    let inventory = this.inventories.get(sessionId) ?? [];
    if (!questReady(def, qp, inventory)) {
      this.systemTo(client, "You haven't finished that quest yet.");
      return;
    }

    // Consume collect-objective items (ledgered destroy).
    for (const obj of def.objectives) {
      if (obj.type !== "collect") continue;
      const r = removeItem(inventory, obj.itemId, obj.count);
      inventory = r.inventory;
      if (r.removed > 0) {
        void recordLedger({ account: player.id, itemId: obj.itemId, delta: -r.removed, reason: "quest_turnin" });
      }
    }
    // Pay out item + coin rewards (ledgered create).
    const payouts = [...(def.rewards.items ?? [])];
    if (def.rewards.coins) payouts.push({ itemId: "coins", qty: def.rewards.coins });
    for (const stack of payouts) {
      const r = addItem(inventory, stack.itemId, stack.qty, itemDef(stack.itemId)?.maxStack ?? 1);
      inventory = r.inventory;
      if (r.added > 0) {
        void recordLedger({ account: player.id, itemId: stack.itemId, delta: r.added, reason: "quest_reward" });
      }
    }
    this.inventories.set(sessionId, inventory);
    for (const reward of def.rewards.xp ?? []) {
      this.awardQuestXp(sessionId, player, reward.skill, reward.amount);
    }

    this.questLogs.set(sessionId, completeQuest(log, msg.questId));
    this.sendInventory(client);
    this.sendQuests(client);
    this.systemTo(client, `Quest complete: ${def.name}!`);
  }

  /** Talk to a nearby NPC — advances any matching talk objectives. */
  private handleTalk(client: Client, msg: TalkPayload): void {
    const sessionId = client.sessionId;
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const npc = npcDef(msg.npcId);
    if (!npc || npc.zone !== this.map.id) return;
    if (distSq(player.x, player.y, npc.x, npc.y) > TALK_RANGE * TALK_RANGE) return;
    const log = this.questLogs.get(sessionId);
    if (!log) return;
    const next = recordTalk(log, npc.id, questDef);
    if (next !== log) {
      this.questLogs.set(sessionId, next);
      this.sendQuests(client);
    }
  }

  /** Buy `qty` of an item from a nearby vendor (coins → item; a coin sink). */
  private handleBuy(client: Client, msg: TradePayload): void {
    const sessionId = client.sessionId;
    const player = this.state.players.get(sessionId);
    if (!player || !player.alive) return;
    const vendor = vendorDef(msg.vendorId);
    if (!vendor || vendor.zone !== this.map.id) return;
    if (distSq(player.x, player.y, vendor.x, vendor.y) > TALK_RANGE * TALK_RANGE) return;
    if (!vendor.stock.includes(msg.itemId)) return; // not sold here
    const def = itemDef(msg.itemId);
    if (!def) return;

    const cost = buyCost(def) * msg.qty;
    const inv = this.inventories.get(sessionId) ?? [];
    if (countItem(inv, "coins") < cost) {
      this.systemTo(client, "You can't afford that.");
      return;
    }
    if (!canAdd(inv, def.id, msg.qty, def.maxStack)) {
      this.systemTo(client, "Your bag is full.");
      return;
    }
    let next = removeItem(inv, "coins", cost).inventory;
    next = addItem(next, def.id, msg.qty, def.maxStack).inventory;
    this.inventories.set(sessionId, next);
    void recordLedger({ account: player.id, itemId: "coins", delta: -cost, reason: "buy" });
    void recordLedger({ account: player.id, itemId: def.id, delta: msg.qty, reason: "buy" });
    this.sendInventory(client);
  }

  /** Sell `qty` of an item to a nearby vendor (item → coins; a coin faucet). */
  private handleSell(client: Client, msg: TradePayload): void {
    const sessionId = client.sessionId;
    const player = this.state.players.get(sessionId);
    if (!player || !player.alive) return;
    const vendor = vendorDef(msg.vendorId);
    if (!vendor || vendor.zone !== this.map.id) return;
    if (distSq(player.x, player.y, vendor.x, vendor.y) > TALK_RANGE * TALK_RANGE) return;
    if (msg.itemId === "coins") return; // can't sell coins for coins
    const def = itemDef(msg.itemId);
    if (!def || def.value <= 0) return; // worthless / unknown

    const inv = this.inventories.get(sessionId) ?? [];
    const removed = removeItem(inv, msg.itemId, msg.qty);
    if (removed.removed <= 0) return; // none held
    const pay = sellValue(def) * removed.removed;
    const next = addItem(removed.inventory, "coins", pay, itemDef("coins")?.maxStack ?? 1).inventory;
    this.inventories.set(sessionId, next);
    void recordLedger({ account: player.id, itemId: msg.itemId, delta: -removed.removed, reason: "sell" });
    void recordLedger({ account: player.id, itemId: "coins", delta: pay, reason: "sell" });
    this.sendInventory(client);
  }

  /** Route a quest's XP reward to the right skill (combat vs non-combat). */
  private awardQuestXp(sessionId: string, player: PlayerSchema, skill: SkillId, amount: number): void {
    if (skill === "melee") this.grantXp(sessionId, player, amount, 0);
    else if (skill === "vitality") this.grantXp(sessionId, player, 0, amount);
    else this.grantSkillXp(sessionId, player, skill, amount);
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
      // A dungeon gate mints a per-party instance ticket: the whole party (or a
      // solo) shares one instance, and the ticket authorizes their join.
      if (isDungeonId(exit.to)) {
        const party = parties.partyOf(player.name);
        payload.ticket = dungeons.ticketFor(party ? party.members : [player.name]);
      }
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

    // Resource gathering: yield on the timer, then auto-repeat while the player
    // stands still in range; moving / leaving / a full bag stops it.
    this.gatherState.forEach((g, sessionId) => {
      const player = this.state.players.get(sessionId);
      const resolved = player ? resourceNode(this.map.id, g.nodeId) : undefined;
      const input = this.inputs.get(sessionId);
      const moving = !!input && (input.dx !== 0 || input.dy !== 0);
      if (!player || !player.alive || !resolved || moving) {
        this.gatherState.delete(sessionId);
        return;
      }
      const { node, def } = resolved;
      if (distSq(player.x, player.y, node.x, node.y) > GATHER_RANGE * GATHER_RANGE) {
        this.gatherState.delete(sessionId);
        return;
      }
      if (now < g.finishAt) return;

      const client = this.clients.find((c) => c.sessionId === sessionId);
      const res = addItem(
        this.inventories.get(sessionId) ?? [],
        def.itemId,
        1,
        itemDef(def.itemId)?.maxStack ?? 1,
      );
      if (res.added <= 0) {
        this.gatherState.delete(sessionId); // bag full — stop gathering
        if (client) this.systemTo(client, "Your bag is full.");
        return;
      }
      this.inventories.set(sessionId, res.inventory);
      // A gathered resource is created into the economy here (kit rule #6).
      void recordLedger({ account: player.id, itemId: def.itemId, delta: res.added, reason: "gather" });
      this.grantSkillXp(sessionId, player, def.skill, def.xp);
      if (client) this.sendInventory(client);
      g.finishAt = now + def.gatherMs; // auto-repeat the next swing/cast
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

  /**
   * In a dungeon, never persist the instanced map id (a relog would try to
   * rejoin a dead instance). Rewrite the saved location to the overworld
   * return zone's return entry, so logging back in lands them at the gate.
   */
  private finalizeSnapshot(snap: SavedCharacter): SavedCharacter {
    if (!this.returnZone) return snap;
    const rz = ZONES[this.returnZone];
    const entry = rz.entries["depths"] ?? rz.entries["default"]!;
    return { ...snap, zone: this.returnZone, x: entry.x, y: entry.y };
  }

  private async snapshotAll(): Promise<void> {
    const snapshots: SavedCharacter[] = [];
    this.state.players.forEach((player, sessionId) =>
      snapshots.push(
        this.finalizeSnapshot(
          toSaved(
            player,
            this.map.id,
            this.inventories.get(sessionId) ?? [],
            this.equipment.get(sessionId) ?? {},
            this.banks.get(sessionId) ?? [],
            this.questLogs.get(sessionId) ?? [],
            this.friendLists.get(sessionId) ?? [],
          ),
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
  quests: QuestLog,
  friends: string[],
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
    miningXp: p.miningXp,
    fishingXp: p.fishingXp,
    smithingXp: p.smithingXp,
    cookingXp: p.cookingXp,
    restedXp: p.restedXp,
    inventory,
    equipment,
    bank,
    quests,
    friends,
  };
}
