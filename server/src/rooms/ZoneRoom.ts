import { Room, ServerError, type Client } from "@colyseus/core";
import {
  ABILITIES,
  ClientMessage,
  MOVE_SPEED,
  ServerMessage,
  TICK_MS,
  resolveAbility,
  type Combatant,
  type CombatEventPayload,
  type JoinZoneOptions,
  type MovePayload,
  type UseAbilityPayload,
  type WelcomePayload,
  type TransferPayload,
  type ChatPayload,
  type ChatBroadcastPayload,
} from "@mmo/shared";
import { EnemySchema, PlayerSchema, ZoneState } from "@mmo/shared/schema/state";
import { MoveSchema, UseAbilitySchema, ChatSchema } from "@mmo/shared/protocol/schemas";
import { stepWithCollision, isBoxFree } from "@mmo/shared/systems/collision";
import { ZONES, DEFAULT_ZONE, isZoneId } from "@mmo/shared/data/zones";
import { exitAt, type ZoneMap } from "@mmo/shared/systems/zonemap";
import { RateLimiter } from "@mmo/shared/systems/ratelimit";
import { verifyToken } from "../auth";
import { censorText } from "../chat";
import { globalBus } from "../services/globalBus";
import { characterStore, type SavedCharacter } from "../persistence/store";

const DUMMY_MAX_HP = 200;
const DUMMY_RESPAWN_MS = 4000;
const SNAPSHOT_INTERVAL_MS = 15_000;
const PLAYER_HALF = 12; // half-extent of a player's collision box, world units

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

  override onCreate(options?: { zoneId?: string }): void {
    const zoneId =
      options?.zoneId && isZoneId(options.zoneId) ? options.zoneId : DEFAULT_ZONE;
    this.map = ZONES[zoneId];

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
    player.hp = saved.hp;
    player.maxHp = saved.maxHp;
    player.level = saved.level;
    player.alive = saved.hp > 0;
    this.state.players.set(client.sessionId, player);
    this.inputs.set(client.sessionId, { dx: 0, dy: 0, playerId });

    const welcome: WelcomePayload = { sessionId: client.sessionId, playerId };
    client.send(ServerMessage.Welcome, welcome);
    console.log(`[zone] ${name} (${playerId}) joined as ${client.sessionId}`);
  }

  override async onLeave(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.transferring.delete(client.sessionId);
    this.chatLimiter.forget(client.sessionId);
    if (!player) return;

    const snapshot = toSaved(player, this.map.id);
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

  /** Spawn this zone's training dummies from the map's enemy markers. */
  private spawnEnemies(): void {
    this.map.enemies.forEach((marker, i) => {
      const enemy = new EnemySchema();
      enemy.id = `dummy-${i + 1}`;
      enemy.name = "Training Dummy";
      enemy.x = marker.x;
      enemy.y = marker.y;
      enemy.hp = DUMMY_MAX_HP;
      enemy.maxHp = DUMMY_MAX_HP;
      enemy.alive = true;
      this.state.enemies.set(enemy.id, enemy);
    });
  }

  private handleUseAbility(client: Client, msg: UseAbilityPayload): void {
    const attacker = this.state.players.get(client.sessionId);
    if (!attacker || !attacker.alive || !msg) return;

    const ability = ABILITIES[msg.abilityId];
    if (!ability) return;

    const now = Date.now();
    if (now - attacker.lastAbilityAt < ability.cooldownMs) return;

    // Resolve the target by its state-map key: enemies first, then players.
    const enemy = this.state.enemies.get(msg.targetId);
    const targetPlayer = enemy ? undefined : this.state.players.get(msg.targetId);
    const targetCombatant: Combatant | undefined = enemy
      ? toCombatant(enemy)
      : targetPlayer
        ? toCombatant(targetPlayer)
        : undefined;
    if (!targetCombatant) return;

    const result = resolveAbility(toCombatant(attacker), targetCombatant, ability);
    if (!result.ok) return;

    attacker.lastAbilityAt = now;

    if (enemy) {
      enemy.hp = result.targetHpAfter;
      if (result.targetDied) {
        enemy.alive = false;
        enemy.respawnAt = now + DUMMY_RESPAWN_MS;
      }
    } else if (targetPlayer) {
      targetPlayer.hp = result.targetHpAfter;
      if (result.targetDied) targetPlayer.alive = false;
    }

    const evt: CombatEventPayload = {
      attackerId: client.sessionId,
      targetId: msg.targetId,
      damage: result.damage,
      targetDied: result.targetDied,
    };
    this.broadcast(ServerMessage.CombatEvent, evt);
  }

  private handleChat(client: Client, msg: ChatPayload): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
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

  private update(deltaMs: number): void {
    const dt = deltaMs / 1000;

    // Integrate movement for every player from their latest input.
    this.state.players.forEach((player, sessionId) => {
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

    // Respawn any dead enemy whose timer has elapsed.
    const now = Date.now();
    this.state.enemies.forEach((enemy) => {
      if (!enemy.alive && enemy.respawnAt > 0 && now >= enemy.respawnAt) {
        enemy.hp = enemy.maxHp;
        enemy.alive = true;
        enemy.respawnAt = 0;
      }
    });
  }

  private async snapshotAll(): Promise<void> {
    const snapshots: SavedCharacter[] = [];
    this.state.players.forEach((player) => snapshots.push(toSaved(player, this.map.id)));
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

function toCombatant(e: PlayerSchema | EnemySchema): Combatant {
  return { x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, alive: e.alive };
}

function toSaved(p: PlayerSchema, zone: string): SavedCharacter {
  return { playerId: p.id, name: p.name, zone, x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, level: p.level };
}
