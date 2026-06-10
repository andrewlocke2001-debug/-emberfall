import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ZoneRoom } from "./rooms/ZoneRoom";

const PORT = Number(process.env["PORT"] ?? 2567);

const gameServer = new Server({
  transport: new WebSocketTransport(),
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
