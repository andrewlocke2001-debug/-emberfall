import Phaser from "phaser";
import { DEFAULT_ZONE, isZoneId } from "@mmo/shared/data/zones";
import { BootScene } from "./scenes/BootScene";
import { ZoneScene } from "./scenes/ZoneScene";
import { getOrCreatePlayerId } from "./net/identity";

const loginEl = document.getElementById("login") as HTMLDivElement;
const nameInput = document.getElementById("name") as HTMLInputElement;
const enterBtn = document.getElementById("enter") as HTMLButtonElement;

// Prefill the remembered name.
nameInput.value = localStorage.getItem("mmo:name") ?? "";

function start(): void {
  const name = nameInput.value.trim() || "Adventurer";
  localStorage.setItem("mmo:name", name);
  loginEl.style.display = "none";

  // `?canvas=1` forces the Canvas renderer — WebGL doesn't paint into
  // headless-Chromium screenshots, so this gives a capturable path for
  // automated visual checks. Real browsers use AUTO (WebGL) for performance.
  const forceCanvas = new URLSearchParams(window.location.search).has("canvas");

  const game = new Phaser.Game({
    type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
    parent: "game",
    backgroundColor: "#0d1018",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    scene: [BootScene, ZoneScene],
  });

  // Pass join options + the starting zone to BootScene via the registry (set
  // synchronously before the scene's deferred boot runs). The zone is the
  // player's last-visited one (kept in localStorage), defaulting to the town.
  const savedZone = localStorage.getItem("mmo:zone");
  const zone = savedZone && isZoneId(savedZone) ? savedZone : DEFAULT_ZONE;
  game.registry.set("zone", zone);
  game.registry.set("joinOpts", { name, playerId: getOrCreatePlayerId() });
}

enterBtn.addEventListener("click", start);
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") start();
});
