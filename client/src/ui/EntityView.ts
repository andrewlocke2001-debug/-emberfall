import Phaser from "phaser";

export type EntityKind = "self" | "player" | "enemy";

interface EntityViewOptions {
  x: number;
  y: number;
  name: string;
  /** Optional body color override (e.g. per mob family). */
  color?: number;
  /** Called when the body is clicked (for tab-targeting). */
  onClick: () => void;
}

const COLORS: Record<EntityKind, number> = {
  self: 0x4ade80,
  player: 0x60a5fa,
  enemy: 0xef4444,
};

const BAR_WIDTH = 46;
const BAR_HEIGHT = 6;

/**
 * The visual for one networked entity: a colored body, a nameplate, and a
 * health bar, grouped in a container so they move together. Pure presentation —
 * it never decides game outcomes, it only renders authoritative server state.
 */
export class EntityView {
  readonly container: Phaser.GameObjects.Container;
  readonly radius: number;

  private readonly scene: Phaser.Scene;
  private readonly body: Phaser.GameObjects.Shape;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly hpBar: Phaser.GameObjects.Rectangle;
  private readonly baseColor: number;

  constructor(scene: Phaser.Scene, kind: EntityKind, opts: EntityViewOptions) {
    this.scene = scene;
    this.radius = kind === "enemy" ? 22 : 16;
    this.baseColor = opts.color ?? COLORS[kind];

    const body =
      kind === "enemy"
        ? scene.add.rectangle(0, 0, this.radius * 2, this.radius * 2, this.baseColor)
        : scene.add.circle(0, 0, this.radius, this.baseColor);
    body.setStrokeStyle(2, 0x0b0e14);
    // The local player should not be clickable as a target.
    if (kind !== "self") {
      body.setInteractive({ useHandCursor: true });
      body.on(
        "pointerdown",
        (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
          e.stopPropagation();
          opts.onClick();
        },
      );
    }
    this.body = body;

    const barY = -this.radius - 8;
    const hpBarBg = scene.add.rectangle(0, barY, BAR_WIDTH, BAR_HEIGHT, 0x2a3142).setOrigin(0.5);
    this.hpBar = scene.add
      .rectangle(-BAR_WIDTH / 2, barY, BAR_WIDTH, BAR_HEIGHT, 0x4ade80)
      .setOrigin(0, 0.5);

    this.nameText = scene.add
      .text(0, barY - 12, opts.name, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: "#e6e6e6",
      })
      .setOrigin(0.5);

    this.container = scene.add
      .container(opts.x, opts.y, [hpBarBg, this.hpBar, this.nameText, body])
      .setDepth(10);
  }

  setName(name: string): void {
    this.nameText.setText(name);
  }

  setHp(hp: number, maxHp: number): void {
    const pct = maxHp > 0 ? Phaser.Math.Clamp(hp / maxHp, 0, 1) : 0;
    this.hpBar.width = BAR_WIDTH * pct;
    this.hpBar.fillColor = pct > 0.5 ? 0x4ade80 : pct > 0.25 ? 0xfacc15 : 0xef4444;
  }

  /** Dim the whole entity while it's dead (downed player / slain mob). */
  setAlive(alive: boolean): void {
    this.container.setAlpha(alive ? 1 : 0.3);
  }

  /** Snap to a world position (used on spawn and for the predicted local player). */
  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  /** Smoothly move toward a world position (used for remote entity interpolation). */
  lerpTo(x: number, y: number, t: number): void {
    this.container.x = Phaser.Math.Linear(this.container.x, x, t);
    this.container.y = Phaser.Math.Linear(this.container.y, y, t);
  }

  /** Brief white flash when hit. */
  hitFlash(): void {
    this.body.setFillStyle(0xffffff);
    this.scene.time.delayedCall(80, () => this.body.setFillStyle(this.baseColor));
  }

  /** Floating "-N" damage number that drifts up and fades. */
  floatingDamage(amount: number): void {
    this.floatingText(`-${amount}`, "#ffd166");
  }

  /** Floating green "+N" heal number. */
  floatingHeal(amount: number): void {
    this.floatingText(`+${amount}`, "#4ade80");
  }

  private floatingText(label: string, color: string): void {
    const text = this.scene.add
      .text(this.container.x, this.container.y - this.radius - 24, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.scene.tweens.add({
      targets: text,
      y: text.y - 32,
      alpha: 0,
      duration: 600,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  destroy(): void {
    this.container.destroy();
  }
}
