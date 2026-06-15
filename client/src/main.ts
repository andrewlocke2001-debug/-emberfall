import Phaser from "phaser";
import { DEFAULT_ZONE, isZoneId } from "@mmo/shared/data/zones";
import { BootScene } from "./scenes/BootScene";
import { ZoneScene } from "./scenes/ZoneScene";
import { getStoredToken, storeToken, guestLogin } from "./net/auth";

const loginEl = document.getElementById("login") as HTMLDivElement;
const nameInput = document.getElementById("name") as HTMLInputElement;
const enterBtn = document.getElementById("enter") as HTMLButtonElement;
const errorEl = document.getElementById("login-error") as HTMLDivElement;

// Prefill the remembered name.
nameInput.value = localStorage.getItem("mmo:name") ?? "";

let busy = false;

/**
 * Enter the world: reuse an existing session token if we have one, otherwise
 * create a guest account (one tap — preserves instant play). The token is what
 * the game presents to the server; identity is derived from it server-side.
 */
async function start(): Promise<void> {
  if (busy) return;
  busy = true;
  enterBtn.disabled = true;
  enterBtn.textContent = "Entering…";
  errorEl.textContent = "";
  try {
    const name = nameInput.value.trim();
    let token = getStoredToken();
    if (!token) {
      token = (await guestLogin(name || undefined)).token;
      storeToken(token);
    }
    if (name) localStorage.setItem("mmo:name", name);
    loginEl.style.display = "none";
    bootGame(token);
  } catch (err) {
    errorEl.textContent = err instanceof Error ? err.message : "Couldn't start. Try again.";
    enterBtn.disabled = false;
    enterBtn.textContent = "Enter World";
    busy = false;
  }
}

function bootGame(token: string): void {
  // `?canvas=1` forces the Canvas renderer — WebGL doesn't paint into
  // headless-Chromium screenshots, so this gives a capturable automated path.
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

  // Starting zone = last visited (localStorage), defaulting to the town.
  const savedZone = localStorage.getItem("mmo:zone");
  const zone = savedZone && isZoneId(savedZone) ? savedZone : DEFAULT_ZONE;
  game.registry.set("zone", zone);
  game.registry.set("joinOpts", { token });
}

enterBtn.addEventListener("click", () => void start());
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void start();
});
