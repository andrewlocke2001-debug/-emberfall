/**
 * Joins the deployed server from Node via the real Colyseus SDK — isolates
 * whether the production websocket path works independent of any browser.
 *   node tools/live-join.mjs https://emberfall-server.fly.dev
 */
import { Client } from "@colyseus/sdk";

const base = process.argv[2] ?? "https://emberfall-server.fly.dev";
const client = new Client(base);
// Log every URL the SDK actually hits (http matchmake + ws room connect).
client.urlBuilder = (url) => {
  console.log(`[live-join] SDK url: ${url.toString()}`);
  return url.toString();
};

const timeout = setTimeout(() => {
  console.error("[live-join] TIMED OUT after 20s — websocket path is broken");
  process.exit(1);
}, 20_000);

try {
  const room = await client.joinOrCreate("zone", { playerId: "smoke-node-1", name: "NodeSmoke" });
  console.log(`[live-join] JOINED room ${room.roomId} as ${room.sessionId}`);
  await new Promise((r) => setTimeout(r, 1500));
  console.log(`[live-join] players in state: ${room.state.players.size}`);
  await room.leave();
  clearTimeout(timeout);
  console.log("[live-join] OK — production websocket works end to end ✔");
  process.exit(0);
} catch (err) {
  clearTimeout(timeout);
  console.error("[live-join] FAILED:", err?.message ?? err);
  process.exit(1);
}
