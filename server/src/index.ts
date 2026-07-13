import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import { ZONE_IDS, DUNGEON_IDS } from "@mmo/shared/data/zones";
import { ZoneRoom } from "./rooms/ZoneRoom";
import { AuthError, registerAccount, loginAccount, guestAccount, type AuthResult } from "./auth";
import { getHiscores, isHiscoreBoard, renderHiscoresHtml } from "./hiscores";
import { getEconomyReport, renderEconomyHtml } from "./economy";

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
    app.use(express.json());

    // Auth endpoints. The client posts credentials (or nothing, for a guest)
    // and gets back a signed token it presents when joining a zone room.
    const route =
      (fn: (body: Record<string, string>) => Promise<AuthResult>) =>
      async (req: express.Request, res: express.Response): Promise<void> => {
        try {
          res.json(await fn((req.body ?? {}) as Record<string, string>));
        } catch (err) {
          if (err instanceof AuthError) {
            res.status(400).json({ error: err.message });
          } else {
            console.error("[auth] route error:", err);
            res.status(500).json({ error: "Something went wrong." });
          }
        }
      };
    app.post(
      "/auth/register",
      route((b) => registerAccount(b["username"]!, b["password"]!, (b["ironman"] as unknown) === true)),
    );
    app.post("/auth/login", route((b) => loginAccount(b["username"]!, b["password"]!)));
    app.post("/auth/guest", route((b) => guestAccount(b["name"])));

    // Public hiscores — crawlable HTML + a JSON API (read-only).
    const boardFrom = (q: unknown): "total" | ReturnType<typeof String> =>
      typeof q === "string" && isHiscoreBoard(q) ? q : "total";
    app.get("/hiscores", async (req, res) => {
      try {
        const board = boardFrom(req.query["skill"]) as Parameters<typeof getHiscores>[0];
        res.type("html").send(renderHiscoresHtml(board, await getHiscores(board)));
      } catch (err) {
        console.error("[hiscores] failed:", err);
        res.status(500).send("Hiscores are unavailable right now.");
      }
    });
    app.get("/api/hiscores", async (req, res) => {
      try {
        const board = boardFrom(req.query["skill"]) as Parameters<typeof getHiscores>[0];
        res.json({ board, rows: await getHiscores(board) });
      } catch (err) {
        console.error("[hiscores] failed:", err);
        res.status(500).json({ error: "Hiscores are unavailable right now." });
      }
    });

    // Faucet/sink economy dashboard (P8.4). Read-only ledger aggregates.
    // Gate with ECONOMY_KEY when set (prod); open in dev where it's unset.
    const economyGate = (req: express.Request, res: express.Response): boolean => {
      const key = process.env["ECONOMY_KEY"];
      if (key && req.query["key"] !== key) {
        res.status(403).send("Forbidden");
        return false;
      }
      return true;
    };
    app.get("/economy", async (req, res) => {
      if (!economyGate(req, res)) return;
      try {
        res.type("html").send(renderEconomyHtml(await getEconomyReport()));
      } catch (err) {
        console.error("[economy] failed:", err);
        res.status(500).send("Economy report unavailable.");
      }
    });
    app.get("/api/economy", async (req, res) => {
      if (!economyGate(req, res)) return;
      try {
        res.json(await getEconomyReport());
      } catch (err) {
        console.error("[economy] failed:", err);
        res.status(500).json({ error: "Economy report unavailable." });
      }
    });

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

// Dungeons reuse ZoneRoom but are INSTANCED: filterBy(["ticket"]) routes each
// party (or solo) to its own room instance, keyed by the server-issued ticket.
// A stray join with no matching ticket is rejected in onJoin.
for (const dungeonId of DUNGEON_IDS) {
  gameServer.define(dungeonId, ZoneRoom, { zoneId: dungeonId }).filterBy(["ticket"]);
}

gameServer
  .listen(PORT)
  .then(() => console.log(`[server] zone server listening on ws://localhost:${PORT}`))
  .catch((err: unknown) => {
    console.error("[server] failed to start:", err);
    process.exit(1);
  });
