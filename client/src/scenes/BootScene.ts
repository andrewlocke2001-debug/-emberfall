import Phaser from "phaser";
import type { JoinZoneOptions } from "@mmo/shared";
import { connectToZone } from "../net/room";

/**
 * Connects to the zone room, then hands the live connection to ZoneScene.
 * Shows a status message while connecting / on failure.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    const opts = this.registry.get("joinOpts") as JoinZoneOptions;
    const status = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "Entering Verdant Vale…", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#e6e6e6",
        align: "center",
      })
      .setOrigin(0.5);

    connectToZone(opts)
      .then((connection) => {
        this.scene.start("Zone", { connection });
      })
      .catch((err: unknown) => {
        console.error("[client] failed to connect:", err);
        status
          .setText("Couldn't reach the server.\nIs it running on :2567?")
          .setColor("#ef4444");
      });
  }
}
