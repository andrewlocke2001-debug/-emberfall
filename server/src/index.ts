import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import { ZoneRoom } from "./rooms/ZoneRoom";

const PORT = Number(process.env["PORT"] ?? 2567);

// Last line of defense: a long-running game server must not die-and-stay-dead
// on a stray async error (the Fly machine would stop until the next visitor
// triggers a slow cold start). Log loudly and keep serving; crashes that
// matter will be visible in `fly logs`.
process.on("uncaughtException", (err) => {
  console.error("[server] UNCAUGHT EXCEPTION (continuing):", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[server] UNHANDLED REJECTION (continuing):", reason);
});

// In production the game server also serves the built client, so one URL
// (the Fly app) is both the web page and the websocket — no separate static
// host required. Locally `client/dist` usually doesn't exist (Vite dev server
// handles the client), so this quietly no-ops.
const clientDist = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "client", "dist");

const gameServer = new Server({
  transport: new WebSocketTransport(),
  express: (app) => {
    if (existsSync(clientDist)) {
      app.use(express.static(clientDist));
      console.log(`[server] serving client from ${clientDist}`);
    }
  },
});

// One registered room type for M0. "zone" is the matchmaking name the client
// passes to joinOrCreate(). A single room instance serves the whole world for
// now; this is the unit we later replicate/shard toward "massive" scale.
gameServer.define("zone", ZoneRoom);

gameServer
  .listen(PORT)
  .then(() => console.log(`[server] zone server listening on ws://localhost:${PORT}`))
  .catch((err: unknown) => {
    console.error("[server] failed to start:", err);
    process.exit(1);
  });
