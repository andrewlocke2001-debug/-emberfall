import { Room, type Client } from "@colyseus/core";
import {
  ABILITIES,
  ClientMessage,
  MOVE_SPEED,
  ServerMessage,
  TICK_MS,
  ZONE_HEIGHT,
  ZONE_WIDTH,
  resolveAbility,
  stepPosition,
  type Combatant,
  type CombatEventPayload,
  type JoinZoneOptions,
  type MovePayload,
  type UseAbilityPayload,
  type WelcomePayload,
} from "@mmo/shared";
import { EnemySchema, PlayerSchema, ZoneState } from "@mmo/shared/schema/state";
import { characterStore, type SavedCharacter } from "../persistence/store";

const DUMMY_ID = "dummy-1";
const DUMMY_MAX_HP = 200;
const DUMMY_RESPAWN_MS = 4000;
const SNAPSHOT_INTERVAL_MS = 15_000;

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

  private inputs = new Map<string, InputState>();

  override onCreate(): void {
    this.state = new ZoneState();
    this.spawnDummy();

    this.onMessage<MovePayload>(ClientMessage.Move, (client, msg) => {
      const input = this.inputs.get(client.sessionId);
      if (!input) return;
      input.dx = clampUnit(msg?.dx ?? 0);
      input.dy = clampUnit(msg?.dy ?? 0);
    });

    this.onMessage<UseAbilityPayload>(ClientMessage.UseAbility, (client, msg) => {
      this.handleUseAbility(client, msg);
    });

    // The authoritative game loop.
    this.setSimulationInterval((dt) => this.update(dt), TICK_MS);

    // Periodically snapshot all online characters so a crash loses little.
    this.clock.setInterval(() => this.snapshotAll(), SNAPSHOT_INTERVAL_MS);
  }

  override async onJoin(client: Client, options: JoinZoneOptions): Promise<void> {
    const playerId = options?.playerId?.trim() || client.sessionId;
    const name = (options?.name?.trim() || "Adventurer").slice(0, 24);

    const spawn = { x: ZONE_WIDTH / 2, y: ZONE_HEIGHT / 2 + 220 };
    const saved = await characterStore.loadOrCreate(playerId, name, spawn);

    const player = new PlayerSchema();
    player.id = playerId;
    player.name = saved.name;
    player.x = saved.x;
    player.y = saved.y;
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
    if (!player) return;

    const snapshot = toSaved(player);
    this.state.players.delete(client.sessionId);
    try {
      await characterStore.save(snapshot);
    } catch (err) {
      console.error(`[zone] failed to save ${snapshot.playerId} on leave:`, err);
    }
  }

  override async onDispose(): Promise<void> {
    await this.snapshotAll();
  }

  // --- internals -----------------------------------------------------------

  private spawnDummy(): void {
    const dummy = new EnemySchema();
    dummy.id = DUMMY_ID;
    dummy.name = "Training Dummy";
    dummy.x = ZONE_WIDTH / 2;
    dummy.y = ZONE_HEIGHT / 2;
    dummy.hp = DUMMY_MAX_HP;
    dummy.maxHp = DUMMY_MAX_HP;
    dummy.alive = true;
    this.state.enemies.set(dummy.id, dummy);
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

  private update(deltaMs: number): void {
    const dt = deltaMs / 1000;

    // Integrate movement for every player from their latest input.
    this.state.players.forEach((player, sessionId) => {
      if (!player.alive) return;
      const input = this.inputs.get(sessionId);
      if (!input || (input.dx === 0 && input.dy === 0)) return;
      const next = stepPosition(
        { x: player.x, y: player.y },
        { dx: input.dx, dy: input.dy },
        dt,
        MOVE_SPEED,
        { width: ZONE_WIDTH, height: ZONE_HEIGHT },
      );
      player.x = next.x;
      player.y = next.y;
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
    this.state.players.forEach((player) => snapshots.push(toSaved(player)));
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

function clampUnit(v: number): number {
  if (Number.isNaN(v)) return 0;
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

function toCombatant(e: PlayerSchema | EnemySchema): Combatant {
  return { x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, alive: e.alive };
}

function toSaved(p: PlayerSchema): SavedCharacter {
  return { playerId: p.id, name: p.name, x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, level: p.level };
}
