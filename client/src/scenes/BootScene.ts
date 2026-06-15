import Phaser from "phaser";
import type { JoinZoneOptions } from "@mmo/shared";
import { connectToZone } from "../net/room";
import { clearToken } from "../net/auth";

/**
 * Connects to the zone room, then hands the live connection to ZoneScene.
 * Surfaces live status while connecting (including the cold-start wake), and
 * on failure offers a tap/key to retry instead of dead-ending.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    const opts = this.registry.get("joinOpts") as JoinZoneOptions;
    const zone = (this.registry.get("zone") as string | undefined) ?? "meadowbrook";
    const status = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "Entering the realm…", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#e6e6e6",
        align: "center",
        wordWrap: { width: Math.min(560, this.scale.width - 40) },
      })
      .setOrigin(0.5);

    connectToZone(zone, opts, (msg) => status.setText(msg))
      .then((connection) => {
        this.scene.start("Zone", { connection });
      })
      .catch((err: unknown) => {
        console.error("[client] failed to connect:", err);
        const detail = err instanceof Error ? err.message : String(err);
        // An expired/invalid token never fixes itself on retry — drop it so the
        // reload logs in fresh (as a guest).
        if (/auth|token|401/i.test(detail)) clearToken();
        status
          .setText(`Couldn't enter the world:\n${detail}\n\nTap or press any key to retry.`)
          .setColor("#ef4444");
        const retry = (): void => {
          window.location.reload();
        };
        this.input.once("pointerdown", retry);
        this.input.keyboard?.once("keydown", retry);
      });
  }
}
