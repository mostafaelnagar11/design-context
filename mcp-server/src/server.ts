import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  getPublishedSystems,
  getTokensForSystem,
  type UserRow,
} from "./db.js";
import { matchSystem } from "./fuzzy.js";

export function createMcpServer(user: UserRow): Server {
  const server = new Server(
    { name: "design-context", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "list_design_systems",
        description:
          "List all published design systems available for this user. Call this first to see which systems Claude can fetch.",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "get_design_system",
        description:
          "Fetch design tokens (colors, typography, spacing, radii, shadows) for a named design system. " +
          "Use the system name exactly as the user mentions it in their prompt.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The design system name as mentioned in the prompt (e.g. 'MoonTech DS')",
            },
          },
          required: ["name"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    if (name === "list_design_systems") {
      const systems = await getPublishedSystems(user.id);
      if (!systems.length) {
        return {
          content: [
            {
              type: "text",
              text: "No published design systems found. Create and publish a system at designctx.io.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Published design systems for ${user.email}:\n${systems
              .map((s) => `• ${s.name}`)
              .join("\n")}`,
          },
        ],
      };
    }

    if (name === "get_design_system") {
      const query = String((args as Record<string, unknown>)?.name ?? "");
      const systems = await getPublishedSystems(user.id);
      const match = matchSystem(query, systems);

      if (match === null) {
        return {
          content: [
            {
              type: "text",
              text: `No published design system found matching "${query}". ` +
                `Available: ${systems.map((s) => s.name).join(", ") || "none"}.`,
            },
          ],
        };
      }

      if (match === "ambiguous") {
        return {
          content: [
            {
              type: "text",
              text: `Multiple systems match "${query}". Please be more specific. ` +
                `Available: ${systems.map((s) => s.name).join(", ")}.`,
            },
          ],
        };
      }

      const tokens = await getTokensForSystem(match.id);

      // Group tokens by category
      const grouped = tokens.reduce<Record<string, Record<string, unknown>>>(
        (acc, t) => {
          const cat = t.category;
          if (!acc[cat]) acc[cat] = {};
          acc[cat]![t.token_name] = t.token_value;
          return acc;
        },
        {}
      );

      const result = {
        system: match.name,
        tokens: grouped,
      };

      return {
        content: [
          {
            type: "text",
            text:
              `Design system: ${match.name}\n\n` +
              "Use the following tokens for all UI generation:\n\n" +
              "```json\n" +
              JSON.stringify(result, null, 2) +
              "\n```",
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  });

  return server;
}
