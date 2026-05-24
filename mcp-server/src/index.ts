import "dotenv/config";
import express, { Request, Response } from "express";

// Crash handlers — set as early as possible after static imports
process.on("uncaughtException", (err) => {
  console.error("[CRASH] uncaughtException:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[CRASH] unhandledRejection:", reason);
  process.exit(1);
});

const app = express();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transports = new Map<string, any>();

// ── Health check is registered FIRST so Railway's healthcheck passes
// immediately while the rest of the modules load below ──────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", sessions: transports.size });
});

// Start listening immediately so healthchecks succeed during cold start
const PORT = parseInt(process.env.PORT ?? "3001", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[startup] Design Context MCP server listening on port ${PORT}`);
});

console.log("[startup] express + health route up");
console.log("[startup] SUPABASE_URL present:", !!process.env.SUPABASE_URL);
console.log("[startup] SUPABASE_KEY present:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("[startup] PORT:", process.env.PORT);

// Dynamically import the MCP SDK and our modules so any failure is caught
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SSEServerTransport: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let getUserByApiKey: (key: string) => Promise<{ id: string; email: string } | null>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let createMcpServer: (user: { id: string; email: string }) => any;

try {
  console.log("[startup] loading MCP SDK...");
  const mcpMod = await import("@modelcontextprotocol/sdk/server/sse.js");
  SSEServerTransport = mcpMod.SSEServerTransport;
  console.log("[startup] MCP SDK ok");
} catch (e) {
  console.error("[startup] MCP SDK failed:", e);
  process.exit(1);
}

try {
  console.log("[startup] loading db...");
  const dbMod = await import("./db.js");
  getUserByApiKey = dbMod.getUserByApiKey;
  console.log("[startup] db ok");
} catch (e) {
  console.error("[startup] db failed:", e);
  process.exit(1);
}

try {
  console.log("[startup] loading server...");
  const srvMod = await import("./server.js");
  createMcpServer = srvMod.createMcpServer;
  console.log("[startup] server module ok");
} catch (e) {
  console.error("[startup] server module failed:", e);
  process.exit(1);
}

function extractApiKey(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

// ── MCP routes registered after modules are fully loaded ───────────────────
app.get("/sse", async (req: Request, res: Response) => {
  const rawKey = extractApiKey(req.headers.authorization);
  if (!rawKey) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const user = await getUserByApiKey(rawKey);
  if (!user) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  const server = createMcpServer(user);
  const transport = new SSEServerTransport("/message", res);

  transports.set(transport.sessionId, transport);
  transport.onclose = () => transports.delete(transport.sessionId);

  await server.connect(transport);
});

app.post("/message", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }

  await transport.handlePostMessage(req, res);
});

console.log("[startup] all routes registered — MCP server fully ready");
