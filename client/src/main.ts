import Phaser from "phaser";
import { DEFAULT_ZONE, isZoneId } from "@mmo/shared/data/zones";
import { BootScene } from "./scenes/BootScene";
import { ZoneScene } from "./scenes/ZoneScene";
import { SOLO } from "./net/mode";
import {
  getStoredToken,
  storeToken,
  guestLogin,
  loginAccount,
  registerAccount,
} from "./net/auth";

const loginEl = document.getElementById("login") as HTMLDivElement;
const nameInput = document.getElementById("name") as HTMLInputElement;
const passwordInput = document.getElementById("password") as HTMLInputElement;
const enterBtn = document.getElementById("enter") as HTMLButtonElement;
const loginBtn = document.getElementById("btn-login") as HTMLButtonElement;
const registerBtn = document.getElementById("btn-register") as HTMLButtonElement;
const errorEl = document.getElementById("login-error") as HTMLDivElement;
const buttons = [enterBtn, loginBtn, registerBtn];

// Prefill the remembered name.
nameInput.value = localStorage.getItem("mmo:name") ?? "";

// Single-player build: no accounts, no server — just a name and Play.
if (SOLO) {
  passwordInput.style.display = "none";
  loginBtn.style.display = "none";
  registerBtn.style.display = "none";
  const ironRow = document.getElementById("ironman-row");
  if (ironRow) ironRow.style.display = "none";
  enterBtn.textContent = "Play";
}

let busy = false;

/**
 * Run an auth action, then boot the game with the resulting token. Identity is
 * derived server-side from the token, so all three paths (guest / login /
 * register) converge here.
 */
async function authenticate(getToken: () => Promise<string>): Promise<void> {
  if (busy) return;
  busy = true;
  buttons.forEach((b) => (b.disabled = true));
  errorEl.textContent = "";
  try {
    const token = await getToken();
    storeToken(token);
    const name = nameInput.value.trim();
    if (name) localStorage.setItem("mmo:name", name);
    loginEl.style.display = "none";
    bootGame(token);
  } catch (err) {
    errorEl.textContent = err instanceof Error ? err.message : "Couldn't start. Try again.";
    buttons.forEach((b) => (b.disabled = false));
    busy = false;
  }
}

function requireCredentials(): { username: string; password: string } {
  const username = nameInput.value.trim();
  const password = passwordInput.value;
  if (!username || !password) throw new Error("Enter a username and password.");
  return { username, password };
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

// Guest: reuse an existing session if present, else create a guest account.
// In single-player there's no server — a placeholder token boots the local game.
enterBtn.addEventListener("click", () =>
  void authenticate(async () =>
    SOLO ? "solo" : (getStoredToken() ?? (await guestLogin(nameInput.value.trim() || undefined)).token),
  ),
);
// Log in / Register always (re)authenticate to the named account.
loginBtn.addEventListener("click", () =>
  void authenticate(async () => {
    const { username, password } = requireCredentials();
    return (await loginAccount(username, password)).token;
  }),
);
registerBtn.addEventListener("click", () =>
  void authenticate(async () => {
    const { username, password } = requireCredentials();
    const ironman = (document.getElementById("ironman") as HTMLInputElement | null)?.checked ?? false;
    return (await registerAccount(username, password, ironman)).token;
  }),
);

nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") enterBtn.click();
});
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn.click();
});
