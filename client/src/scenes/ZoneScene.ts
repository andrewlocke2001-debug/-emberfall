import Phaser from "phaser";
import {
  ABILITIES,
  ClientMessage,
  MOVE_SPEED,
  ServerMessage,
  type AbilityId,
  type CombatEventPayload,
  type JoinZoneOptions,
  type TransferPayload,
  type ChatBroadcastPayload,
} from "@mmo/shared";
import { stepWithCollision } from "@mmo/shared/systems/collision";
import { ZONES, DEFAULT_ZONE, isZoneId } from "@mmo/shared/data/zones";
import { MOBS } from "@mmo/shared/data/mobs";
import type { ZoneMap } from "@mmo/shared/systems/zonemap";
import type { EnemySchema, PlayerSchema } from "@mmo/shared/schema/state";
import type { ZoneConnection } from "../net/room";
import { EntityView } from "../ui/EntityView";
import { TouchControls } from "../ui/TouchControls";
import { ChatBox } from "../ui/ChatBox";
import { AbilityBar } from "../ui/AbilityBar";

const RECONCILE_SNAP = 64; // px of drift beyond which we hard-snap the local player
const REMOTE_LERP = 0.25; // interpolation factor for remote entities
const PLAYER_HALF = 12; // must match the server's collision box half-extent

// Tile colors keyed by gid (see tools/mapgen). Trees render as a canopy
// circle (TREE_GID) for a softer look; everything else fills its tile.
const TREE_GID = 4;
const GROUND_COLORS: Record<number, number> = { 1: 0x243a1c, 2: 0x4a3f2c, 6: 0x5a4631 };
const OBSTACLE_COLORS: Record<number, number> = { 3: 0x6b6660, 5: 0x21406b, 7: 0x6b573c };

/**
 * The playable zone. Renders authoritative server state, predicts the local
 * player's movement for responsiveness, and forwards player intent (move /
 * attack) to the server. It never resolves combat or trusts its own positions —
 * the server is authoritative.
 */
export class ZoneScene extends Phaser.Scene {
  private connection!: ZoneConnection;
  private localSessionId = "";

  private readonly players = new Map<string, EntityView>();
  private readonly enemies = new Map<string, EntityView>();

  private predicted = { x: 0, y: 0 };
  private predictionReady = false;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private escKey!: Phaser.Input.Keyboard.Key;

  private selectedTargetId: string | null = null;
  private selectionRing!: Phaser.GameObjects.Arc;

  private lastSentDir = { dx: 0, dy: 0 };
  private lastMoveSentAt = 0;

  /** On-screen joystick + attack button; only created on touch devices. */
  private touch?: TouchControls;
  /** Ability bar UI (energy meter + per-ability cooldowns). */
  private abilityBar?: AbilityBar;

  /** The current zone's map; resolved from server state on the first frame. */
  private map?: ZoneMap;

  /** DOM chat overlay + zone HUD. */
  private chat?: ChatBox;
  private lastHud = "";

  /** Screen-fixed "you died" banner, shown while the local player is down. */
  private deathText?: Phaser.GameObjects.Text;

  constructor() {
    super("Zone");
  }

  init(data: { connection: ZoneConnection }): void {
    this.connection = data.connection;
    this.localSessionId = data.connection.room.sessionId;
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0d1018");
    // The tilemap + camera bounds are set on the first state frame, once we
    // know which zone the server put us in (see ensureWorld).

    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys("W,A,S,D,SPACE,ONE,TWO,THREE") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.escKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    keyboard.addCapture("W,A,S,D,SPACE,ONE,TWO,THREE,UP,DOWN,LEFT,RIGHT");

    this.selectionRing = this.add
      .circle(0, 0, 28)
      .setStrokeStyle(2, 0xffe066)
      .setVisible(false)
      .setDepth(5);

    this.escKey.on("down", () => this.selectTarget(null));

    this.deathText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "You fell — respawning…", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        color: "#ef4444",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(500)
      .setVisible(false);
    this.scale.on("resize", () =>
      this.deathText?.setPosition(this.scale.width / 2, this.scale.height / 2),
    );

    // On touch / coarse-pointer devices, add the on-screen joystick + attack
    // button. Keyboard handlers stay active too (hybrid devices just work).
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    if (coarse || this.sys.game.device.input.touch) {
      this.touch = new TouchControls(this);
    }

    // DOM chat overlay + HUD. While the chat input is focused, pause keyboard
    // movement so typing doesn't drive the character.
    this.chat = new ChatBox({
      onSend: (channel, text) => this.connection.room.send(ClientMessage.Chat, { channel, text }),
      onFocusChange: (focused) => {
        if (this.input.keyboard) this.input.keyboard.enabled = !focused;
      },
    });
    this.events.once("shutdown", () => this.chat?.destroy());

    this.abilityBar = new AbilityBar({ onUse: (id) => this.tryUseAbility(id) });
    this.events.once("shutdown", () => this.abilityBar?.destroy());

    this.setupStateSync();
    this.setupMessages();
    this.exposeTestApi();
  }

  override update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const room = this.connection.room;

    // The schema state streams in shortly AFTER join. On a remote server the
    // first few frames run before it arrives (invisible on localhost, where
    // it's sub-millisecond) — touching room.state.players.get() then throws
    // "Cannot read properties of undefined" and freezes the render loop.
    // Bail until the synced collections exist.
    if (!room.state?.players || !room.state.enemies) return;

    // Draw the zone's tilemap once we know which zone we're in.
    this.ensureWorld();

    // Zone HUD (name + live player count), refreshed only when it changes.
    const hud = `${this.map?.displayName ?? ""} — ${room.state.players.size} online`;
    if (hud !== this.lastHud) {
      this.chat?.setHud(hud);
      this.lastHud = hud;
    }

    // --- read input → movement intent (keyboard digital + joystick analog)
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.keys["A"]!.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.keys["D"]!.isDown) dx += 1;
    if (this.cursors.up.isDown || this.keys["W"]!.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.keys["S"]!.isDown) dy += 1;
    if (this.touch) {
      const v = this.touch.moveVector();
      if (v.dx !== 0 || v.dy !== 0) {
        dx = v.dx;
        dy = v.dy;
      }
    }

    // Throttle move intents: the analog joystick changes every frame, but the
    // room caps inbound messages (maxMessagesPerSecond). Send on a meaningful
    // change at ~12/s, and always send the stop immediately.
    const now = performance.now();
    const moveChanged =
      Math.abs(dx - this.lastSentDir.dx) > 0.08 || Math.abs(dy - this.lastSentDir.dy) > 0.08;
    const stopped = dx === 0 && dy === 0 && (this.lastSentDir.dx !== 0 || this.lastSentDir.dy !== 0);
    if (stopped || (moveChanged && now - this.lastMoveSentAt >= 80)) {
      room.send(ClientMessage.Move, { dx, dy });
      this.lastSentDir = { dx, dy };
      this.lastMoveSentAt = now;
    }

    // --- local player prediction + reconciliation
    const self = room.state.players.get(this.localSessionId);
    if (self && this.map) {
      if (!this.predictionReady) {
        this.predicted = { x: self.x, y: self.y };
        this.predictionReady = true;
      }
      if (!self.alive) {
        // While dead, don't predict — just follow the authoritative position
        // (it snaps to the respawn point when the server revives us).
        this.predicted = { x: self.x, y: self.y };
      } else {
        this.predicted = stepWithCollision(
          this.predicted,
          { dx, dy },
          dt,
          MOVE_SPEED,
          this.map.collision,
          PLAYER_HALF,
        );
        const drift = Phaser.Math.Distance.Between(
          this.predicted.x,
          this.predicted.y,
          self.x,
          self.y,
        );
        if (drift > RECONCILE_SNAP) {
          this.predicted = { x: self.x, y: self.y };
        } else if (drift > 2) {
          this.predicted.x = Phaser.Math.Linear(this.predicted.x, self.x, 0.1);
          this.predicted.y = Phaser.Math.Linear(this.predicted.y, self.y, 0.1);
        }
      }
    }
    this.deathText?.setVisible(!!self && !self.alive);

    // --- render entities from authoritative state
    room.state.players.forEach((player, sessionId) => {
      const view = this.players.get(sessionId);
      if (!view) return;
      if (sessionId === this.localSessionId) {
        view.setPosition(this.predicted.x, this.predicted.y);
      } else {
        view.lerpTo(player.x, player.y, REMOTE_LERP);
      }
      view.setHp(player.hp, player.maxHp);
      view.setAlive(player.alive);
    });
    room.state.enemies.forEach((enemy, id) => {
      const view = this.enemies.get(id);
      if (!view) return;
      view.lerpTo(enemy.x, enemy.y, REMOTE_LERP);
      view.setHp(enemy.hp, enemy.maxHp);
      view.setAlive(enemy.alive);
    });

    this.updateSelectionRing();

    // --- abilities: refresh the bar (energy + cooldowns), then handle input
    if (self) this.abilityBar?.setEnergy(self.energy, self.maxEnergy);
    this.abilityBar?.render();

    // 1/2/3 fire on press; held Space (or the touch button) auto-repeats the
    // basic Strike whenever it comes off the global cooldown.
    if (Phaser.Input.Keyboard.JustDown(this.keys["ONE"]!)) this.tryUseAbility("strike");
    if (Phaser.Input.Keyboard.JustDown(this.keys["TWO"]!)) this.tryUseAbility("power_strike");
    if (Phaser.Input.Keyboard.JustDown(this.keys["THREE"]!)) this.tryUseAbility("mend");
    if (this.keys["SPACE"]!.isDown || (this.touch?.attackHeld() ?? false)) {
      this.tryUseAbility("strike");
    }
  }

  /** Client-side gate (target/energy/cooldown) then send the ability intent. */
  private tryUseAbility(id: AbilityId): void {
    const room = this.connection.room;
    const self = room.state.players.get(this.localSessionId);
    if (!self || !self.alive || !this.abilityBar) return;
    if (!this.abilityBar.canUse(id, self.energy)) return;

    if (ABILITIES[id].kind === "heal") {
      room.send(ClientMessage.UseAbility, { abilityId: id, targetId: this.localSessionId });
    } else {
      if (!this.selectedTargetId) return; // attacks need a target
      room.send(ClientMessage.UseAbility, { abilityId: id, targetId: this.selectedTargetId });
    }
    this.abilityBar.markUsed(id);
  }

  // --- setup -----------------------------------------------------------------

  private setupStateSync(): void {
    const { room, $ } = this.connection;

    $(room.state).players.onAdd((player: PlayerSchema, sessionId: string) => {
      const isSelf = sessionId === this.localSessionId;
      const view = new EntityView(this, isSelf ? "self" : "player", {
        x: player.x,
        y: player.y,
        name: player.name,
        onClick: () => {
          if (!isSelf) this.selectTarget(sessionId);
        },
      });
      view.setHp(player.hp, player.maxHp);
      this.players.set(sessionId, view);

      if (isSelf) {
        this.predicted = { x: player.x, y: player.y };
        this.predictionReady = true;
        this.cameras.main.startFollow(view.container, true, 0.12, 0.12);
      }
    });

    $(room.state).players.onRemove((_player: PlayerSchema, sessionId: string) => {
      this.players.get(sessionId)?.destroy();
      this.players.delete(sessionId);
      if (this.selectedTargetId === sessionId) this.selectTarget(null);
    });

    $(room.state).enemies.onAdd((enemy: EnemySchema, id: string) => {
      const view = new EntityView(this, "enemy", {
        x: enemy.x,
        y: enemy.y,
        name: enemy.name,
        color: MOBS[enemy.kind]?.color ?? 0xef4444,
        onClick: () => this.selectTarget(id),
      });
      view.setHp(enemy.hp, enemy.maxHp);
      this.enemies.set(id, view);
    });

    $(room.state).enemies.onRemove((_enemy: EnemySchema, id: string) => {
      this.enemies.get(id)?.destroy();
      this.enemies.delete(id);
      if (this.selectedTargetId === id) this.selectTarget(null);
    });
  }

  private setupMessages(): void {
    // The client already knows its own id via room.sessionId; we still register
    // a handler so the SDK doesn't warn about an unhandled 'welcome' message.
    this.connection.room.onMessage(ServerMessage.Welcome, () => {});

    this.connection.room.onMessage(ServerMessage.CombatEvent, (evt: CombatEventPayload) => {
      const targetView = this.enemies.get(evt.targetId) ?? this.players.get(evt.targetId);
      if (!targetView) return;
      if (evt.heal) {
        targetView.floatingHeal(evt.damage);
      } else {
        targetView.hitFlash();
        targetView.floatingDamage(evt.damage);
      }
    });

    // Zone travel: the server says we stepped on a gate → leave this room and
    // re-boot into the target zone at the named entry. Re-booting cleanly
    // tears down this scene's map/entities for the new zone.
    this.connection.room.onMessage(ServerMessage.Chat, (p: ChatBroadcastPayload) => {
      this.chat?.addMessage(p);
    });

    this.connection.room.onMessage(ServerMessage.Transfer, (p: TransferPayload) => {
      localStorage.setItem("mmo:zone", p.zone);
      const opts = this.registry.get("joinOpts") as JoinZoneOptions;
      this.registry.set("joinOpts", { ...opts, entry: p.entry });
      this.registry.set("zone", p.zone);
      void this.connection.room.leave();
      this.scene.start("Boot");
    });
  }

  // --- helpers ---------------------------------------------------------------

  /** Resolve the current zone from server state and draw it once. */
  private ensureWorld(): void {
    if (this.map) return;
    const zoneId = isZoneId(this.connection.room.state.zoneId)
      ? this.connection.room.state.zoneId
      : DEFAULT_ZONE;
    this.map = ZONES[zoneId];
    this.drawTilemap(this.map);
    this.cameras.main.setBounds(0, 0, this.map.pixelWidth, this.map.pixelHeight);
  }

  /** Render the zone's ground + obstacle tiles once into a static graphic. */
  private drawTilemap(map: ZoneMap): void {
    const g = this.add.graphics().setDepth(-10);
    const t = map.tileSize;
    for (let i = 0; i < map.ground.length; i++) {
      const x = (i % map.cols) * t;
      const y = Math.floor(i / map.cols) * t;
      g.fillStyle(GROUND_COLORS[map.ground[i]!] ?? 0x1a2417, 1);
      g.fillRect(x, y, t, t);

      const obstacle = map.obstacles[i]!;
      if (obstacle === TREE_GID) {
        g.fillStyle(0x14361f, 1);
        g.fillCircle(x + t / 2, y + t / 2, t * 0.5);
      } else if (obstacle !== 0) {
        g.fillStyle(OBSTACLE_COLORS[obstacle] ?? 0x444444, 1);
        g.fillRect(x, y, t, t);
      }
    }
  }

  private selectTarget(id: string | null): void {
    this.selectedTargetId = id;
    if (!id) this.selectionRing.setVisible(false);
  }

  private updateSelectionRing(): void {
    if (!this.selectedTargetId) {
      this.selectionRing.setVisible(false);
      return;
    }
    const view = this.enemies.get(this.selectedTargetId) ?? this.players.get(this.selectedTargetId);
    if (!view) {
      this.selectionRing.setVisible(false);
      return;
    }
    this.selectionRing
      .setVisible(true)
      .setPosition(view.container.x, view.container.y)
      .setRadius(view.radius + 8);
  }

  /** A small deterministic API for end-to-end tests (and debugging). */
  private exposeTestApi(): void {
    const room = this.connection.room;
    (window as unknown as { __mmo?: unknown }).__mmo = {
      ready: true,
      sessionId: () => room.sessionId,
      zone: () => room.state?.zoneId ?? null,
      playerCount: () => room.state?.players?.size ?? 0,
      enemyHp: (id: string) => room.state?.enemies?.get(id)?.hp ?? null,
      enemyMaxHp: (id: string) => room.state?.enemies?.get(id)?.maxHp ?? null,
      me: () => {
        const p = room.state?.players?.get(room.sessionId);
        return p
          ? { x: p.x, y: p.y, hp: p.hp, energy: p.energy, name: p.name, level: p.level }
          : null;
      },
      energy: () => room.state?.players?.get(room.sessionId)?.energy ?? 0,
      setTarget: (id: string | null) => this.selectTarget(id),
      attack: (targetId: string) =>
        room.send(ClientMessage.UseAbility, { abilityId: "strike", targetId }),
      useAbility: (abilityId: string, targetId: string) =>
        room.send(ClientMessage.UseAbility, { abilityId, targetId }),
      move: (dx: number, dy: number) => room.send(ClientMessage.Move, { dx, dy }),
    };
  }
}
