import Phaser from "phaser";

/**
 * On-screen touch controls for mobile, screen-fixed and self-managing:
 *  - a dynamic virtual joystick (left thumb — appears wherever you press)
 *  - a held attack button (right thumb)
 *
 * It exposes the SAME intent shape the keyboard produces — a move vector in
 * [-1, 1] and an "attack held" flag — so ZoneScene's input handling stays
 * input-source-agnostic. Created only on touch/coarse-pointer devices; it
 * coexists harmlessly with keyboard input on hybrid devices.
 */
export class TouchControls {
  private readonly scene: Phaser.Scene;
  private readonly radius = 64;
  private readonly base: Phaser.GameObjects.Arc;
  private readonly thumb: Phaser.GameObjects.Arc;
  private readonly attackBtn: Phaser.GameObjects.Arc;
  private readonly attackIcon: Phaser.GameObjects.Text;

  private move = { dx: 0, dy: 0 };
  private joyId: number | null = null;
  private attackId: number | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const depth = 1000;

    this.base = scene.add
      .circle(0, 0, this.radius, 0xffffff, 0.08)
      .setScrollFactor(0)
      .setDepth(depth)
      .setVisible(false);
    this.thumb = scene.add
      .circle(0, 0, 30, 0xffffff, 0.28)
      .setScrollFactor(0)
      .setDepth(depth + 1)
      .setVisible(false);
    this.attackBtn = scene.add
      .circle(0, 0, 48, 0xef4444, 0.32)
      .setScrollFactor(0)
      .setDepth(depth)
      .setStrokeStyle(2, 0xffffff, 0.6);
    this.attackIcon = scene.add
      .text(0, 0, "⚔", { fontSize: "30px", color: "#ffffff" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);

    scene.input.addPointer(2); // allow move + attack simultaneously (multitouch)
    this.layout();
    scene.scale.on("resize", this.layout, this);
    scene.input.on("pointerdown", this.onDown, this);
    scene.input.on("pointermove", this.onMove, this);
    scene.input.on("pointerup", this.onUp, this);
    scene.input.on("pointerupoutside", this.onUp, this);
  }

  /** Current analog move intent, components in [-1, 1]. */
  moveVector(): { dx: number; dy: number } {
    return this.move;
  }

  /** Whether the attack button is currently held. */
  attackHeld(): boolean {
    return this.attackId !== null;
  }

  private layout(): void {
    const { width, height } = this.scene.scale;
    this.attackBtn.setPosition(width - 78, height - 90);
    this.attackIcon.setPosition(width - 78, height - 90);
  }

  private isOnAttack(p: Phaser.Input.Pointer): boolean {
    return Phaser.Math.Distance.Between(p.x, p.y, this.attackBtn.x, this.attackBtn.y) <= 54;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.attackId === null && this.isOnAttack(p)) {
      this.attackId = p.id;
      this.attackBtn.setFillStyle(0xef4444, 0.6);
      return;
    }
    // Left ~60% of the screen drives the joystick; the right side is reserved
    // for the attack button + tapping targets.
    if (this.joyId === null && p.x < this.scene.scale.width * 0.6) {
      this.joyId = p.id;
      this.base.setPosition(p.x, p.y).setVisible(true);
      this.thumb.setPosition(p.x, p.y).setVisible(true);
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.joyId) return;
    let dx = p.x - this.base.x;
    let dy = p.y - this.base.y;
    const len = Math.hypot(dx, dy);
    if (len > this.radius) {
      dx = (dx / len) * this.radius;
      dy = (dy / len) * this.radius;
    }
    this.thumb.setPosition(this.base.x + dx, this.base.y + dy);
    const nx = dx / this.radius;
    const ny = dy / this.radius;
    // Dead zone so a resting thumb doesn't drift the character.
    this.move = Math.hypot(nx, ny) < 0.18 ? { dx: 0, dy: 0 } : { dx: nx, dy: ny };
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.attackId) {
      this.attackId = null;
      this.attackBtn.setFillStyle(0xef4444, 0.32);
    }
    if (p.id === this.joyId) {
      this.joyId = null;
      this.move = { dx: 0, dy: 0 };
      this.base.setVisible(false);
      this.thumb.setVisible(false);
    }
  }
}
