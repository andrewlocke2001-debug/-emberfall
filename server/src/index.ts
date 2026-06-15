import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import { ZONE_IDS } from "@mmo/shared/data/zones";
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
      // index.html must never be cached, or players keep running a stale
      // client after a deploy (content-hashed assets are safe to cache).
      app.use(
        express.static(clientDist, {
          setHeaders: (res, filePath) => {
            if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
          },
        }),
      );
      // SPA fallback: serve the game for any GET path that isn't an API call
      // or a real asset (a phone autocompleting a stray path shouldn't 404).
      app.get(/.*/, (req, res, next) => {
        if (req.path.startsWith("/matchmake") || req.path.includes(".")) {
          next();
          return;
        }
        res.setHeader("Cache-Control", "no-store");
        res.sendFile(join(clientDist, "index.html"));
      });
      console.log(`[server] serving client from ${clientDist}`);
    }
  },
});

// One room type per zone — the room name IS the zone id, so the client joins a
// specific zone by name and travels by leaving and joining another. Each zone
// is a single room instance for now; this is the unit we later replicate/shard
// toward "massive" scale.
for (const zoneId of ZONE_IDS) {
  gameServer.define(zoneId, ZoneRoom, { zoneId });
}

gameServer
  .listen(PORT)
  .then(() => console.log(`[server] zone server listening on ws://localhost:${PORT}`))
  .catch((err: unknown) => {
    console.error("[server] failed to start:", err);
    process.exit(1);
  });
