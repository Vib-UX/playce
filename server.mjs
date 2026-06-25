import { createServer } from "node:http";
import next from "next";
import { attachSixSevenWss } from "./server/six-seven-ws.mjs";
import { attachChessWss } from "./server/chess-ws.mjs";
import { hydrateChessStore } from "./src/lib/server/chess-store.mjs";
import { hydrateStakeRegistry } from "./src/lib/server/stake-registry.mjs";
import { hydrateLeaderboard } from "./src/lib/server/leaderboard-store.mjs";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });

await app.prepare();

// Rehydrate the server-side stores from Redis before accepting traffic so that
// chess rooms, confirmed stakes and leaderboard standings survive restarts.
try {
  const [chess, stakes, leaderboard] = await Promise.all([
    hydrateChessStore(),
    hydrateStakeRegistry(),
    hydrateLeaderboard(),
  ]);
  if (chess || stakes || leaderboard) {
    console.log(
      `↺ Rehydrated stores from Redis — chess:${chess} stakes:${stakes} leaderboard:${leaderboard}`,
    );
  }
} catch (err) {
  console.error("[boot] store hydration failed (continuing in-memory):", err);
}

const handle = app.getRequestHandler();
const upgradeHandler = app.getUpgradeHandler();

const server = createServer((req, res) => {
  handle(req, res);
});

// Authoritative "67" game socket lives on /api/ws; the chess result relay on
// /api/chess-ws. Everything else (notably the Turbopack/HMR socket in dev) is
// forwarded to Next's own upgrade handler.
const wss = attachSixSevenWss();
const chessWss = attachChessWss();

server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (pathname === "/api/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else if (pathname === "/api/chess-ws") {
    chessWss.handleUpgrade(req, socket, head, (ws) => {
      chessWss.emit("connection", ws, req);
    });
  } else {
    upgradeHandler(req, socket, head);
  }
});

server.listen(port, hostname, () => {
  console.log(
    `▲ Playces ready on http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${port} (ws: /api/ws)`,
  );
});
