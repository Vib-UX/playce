import { createServer } from "node:http";
import next from "next";
import { attachSixSevenWss } from "./server/six-seven-ws.mjs";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });

await app.prepare();

const handle = app.getRequestHandler();
const upgradeHandler = app.getUpgradeHandler();

const server = createServer((req, res) => {
  handle(req, res);
});

// Authoritative "67" game socket lives on /api/ws. Everything else (notably the
// Turbopack/HMR socket in dev) is forwarded to Next's own upgrade handler.
const wss = attachSixSevenWss();

server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (pathname === "/api/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    upgradeHandler(req, socket, head);
  }
});

server.listen(port, hostname, () => {
  console.log(
    `▲ Playce ready on http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${port} (ws: /api/ws)`,
  );
});
