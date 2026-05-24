import "dotenv/config";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { getUserByApiKey } from "./db.js";
import { createMcpServer } from "./server.js";

const app = express();
app.use(express.json());

// session id → active transport (for message routing)
const transports = new Map<string, SSEServerTransport>();

function extractApiKey(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

// SSE connection endpoint — Claude connects here
app.get("/sse", async (req, res) => {
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

// Message endpoint — Claude posts tool calls here
app.post("/message", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", sessions: transports.size });
});

const PORT = parseInt(process.env.PORT ?? "3001", 10);
app.listen(PORT, () => {
  console.log(`Design Context MCP server running on http://localhost:${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});
