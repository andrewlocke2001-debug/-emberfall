/**
 * Raw production WebSocket probe: reserve a seat via matchmaking, then
 * attempt the exact upgrade the SDK would, reporting precisely how it fails.
 *   node tools/live-ws-probe.mjs https://emberfall-server.fly.dev
 */
import WebSocket from "ws";

const base = process.argv[2] ?? "https://emberfall-server.fly.dev";

const res = await fetch(`${base}/matchmake/joinOrCreate/zone`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
const reservation = await res.json();
console.log("[probe] reservation:", JSON.stringify(reservation));

const host = new URL(base).host;
const wsUrl = `wss://${host}/${reservation.processId}/${reservation.roomId}?sessionId=${reservation.sessionId}`;
console.log("[probe] upgrading:", wsUrl);

const ws = new WebSocket(wsUrl);
const started = Date.now();

const bail = setTimeout(() => {
  console.error(`[probe] TIMED OUT after 15s — no handshake response at all`);
  process.exit(1);
}, 15_000);

ws.on("open", () => {
  console.log(`[probe] OPEN after ${Date.now() - started}ms — upgrade works!`);
});
ws.on("message", (data) => {
  console.log(`[probe] first message: ${data.length ?? data.byteLength} bytes — room protocol alive ✔`);
  clearTimeout(bail);
  ws.close();
  process.exit(0);
});
ws.on("unexpected-response", (_req, resp) => {
  console.error(`[probe] HANDSHAKE REJECTED: HTTP ${resp.statusCode} ${resp.statusMessage}`);
  let body = "";
  resp.on("data", (c) => (body += c));
  resp.on("end", () => {
    console.error(`[probe] body: ${body.slice(0, 300)}`);
    process.exit(1);
  });
});
ws.on("error", (err) => {
  console.error(`[probe] ERROR after ${Date.now() - started}ms:`, err.message);
});
ws.on("close", (code, reason) => {
  console.error(`[probe] CLOSED after ${Date.now() - started}ms: code=${code} reason=${reason}`);
});
