/**
 * Preload for the Emberfall desktop shell. Deliberately near-empty: the game
 * needs no privileged APIs (offline, localStorage saves). It only marks the
 * desktop build so the client could adapt later (e.g. a Quit button), and is
 * the future seam for Steamworks bridging (achievements etc.).
 */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("emberfallDesktop", { version: "1.0.0" });
