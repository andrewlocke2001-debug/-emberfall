import Phaser from "phaser";
import {
  ABILITIES,
  ClientMessage,
  MOVE_SPEED,
  ServerMessage,
  ZONE_HEIGHT,
  ZONE_WIDTH,
  stepPosition,
  type CombatEventPayload,
} from "@mmo/shared";
import type { EnemySchema, PlayerSchema } from "@mmo/shared/schema/state";
import type { ZoneConnection } from "../net/room";
import { EntityView } from "../ui/EntityView";
import { TouchControls } from "../ui/TouchControls";

const STRIKE = ABILITIES.strike;
const RECONCILE_SNAP = 64; // px of drift beyond which we hard-snap the local player
const REMOTE_LERP = 0.25; // interpolation factor for remote entities

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
  private lastAttackAt = 0;

  /** On-screen joystick + attack button; only created on touch devices. */
  private touch?: TouchControls;

  constructor() {
    super("Zone");
  }

  init(data: { connection: ZoneConnection }): void {
    this.connection = data.connection;
    this.localSessionId = data.connection.room.sessionId;
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0d1018");
    this.drawWorld();
    this.cameras.main.setBounds(0, 0, ZONE_WIDTH, ZONE_HEIGHT);

    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys("W,A,S,D,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    this.escKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    keyboard.addCapture("W,A,S,D,SPACE,UP,DOWN,LEFT,RIGHT");

    this.selectionRing = this.add
      .circle(0, 0, 28)
      .setStrokeStyle(2, 0xffe066)
      .setVisible(false)
      .setDepth(5);

    this.escKey.on("down", () => this.selectTarget(null));

    // On touch / coarse-pointer devices, add the on-screen joystick + attack
    // button. Keyboard handlers stay active too (hybrid devices just work).
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    if (coarse || this.sys.game.device.input.touch) {
      this.touch = new TouchControls(this);
    }

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
    if (self) {
      if (!this.predictionReady) {
        this.predicted = { x: self.x, y: self.y };
        this.predictionReady = true;
      }
      this.predicted = stepPosition(this.predicted, { dx, dy }, dt, MOVE_SPEED, {
        width: ZONE_WIDTH,
        height: ZONE_HEIGHT,
      });
      const drift = Phaser.Math.Distance.Between(this.predicted.x, this.predicted.y, self.x, self.y);
      if (drift > RECONCILE_SNAP) {
        this.predicted = { x: self.x, y: self.y };
      } else if (drift > 2) {
        this.predicted.x = Phaser.Math.Linear(this.predicted.x, self.x, 0.1);
        this.predicted.y = Phaser.Math.Linear(this.predicted.y, self.y, 0.1);
      }
    }

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
    });
    room.state.enemies.forEach((enemy, id) => {
      const view = this.enemies.get(id);
      if (!view) return;
      view.lerpTo(enemy.x, enemy.y, REMOTE_LERP);
      view.setHp(enemy.hp, enemy.maxHp);
    });

    this.updateSelectionRing();

    // --- attack (held Space or the on-screen button), gated by cooldown
    const attacking = this.keys["SPACE"]!.isDown || (this.touch?.attackHeld() ?? false);
    if (attacking && this.selectedTargetId && now - this.lastAttackAt >= STRIKE.cooldownMs) {
      room.send(ClientMessage.UseAbility, {
        abilityId: "strike",
        targetId: this.selectedTargetId,
      });
      this.lastAttackAt = now;
    }
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
      targetView.hitFlash();
      targetView.floatingDamage(evt.damage);
    });
  }

  // --- helpers ---------------------------------------------------------------

  private drawWorld(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x0d1018, 1).fillRect(0, 0, ZONE_WIDTH, ZONE_HEIGHT);
    g.lineStyle(1, 0x1b2233, 1);
    for (let x = 0; x <= ZONE_WIDTH; x += 80) g.lineBetween(x, 0, x, ZONE_HEIGHT);
    for (let y = 0; y <= ZONE_HEIGHT; y += 80) g.lineBetween(0, y, ZONE_WIDTH, y);
    g.lineStyle(3, 0x3b4a66, 1).strokeRect(0, 0, ZONE_WIDTH, ZONE_HEIGHT);
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
      playerCount: () => room.state?.players?.size ?? 0,
      enemyHp: (id: string) => room.state?.enemies?.get(id)?.hp ?? null,
      enemyMaxHp: (id: string) => room.state?.enemies?.get(id)?.maxHp ?? null,
      me: () => {
        const p = room.state?.players?.get(room.sessionId);
        return p ? { x: p.x, y: p.y, hp: p.hp, name: p.name, level: p.level } : null;
      },
      setTarget: (id: string | null) => this.selectTarget(id),
      attack: (targetId: string) =>
        room.send(ClientMessage.UseAbility, { abilityId: "strike", targetId }),
      move: (dx: number, dy: number) => room.send(ClientMessage.Move, { dx, dy }),
    };
  }
}
