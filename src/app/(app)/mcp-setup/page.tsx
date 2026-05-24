import { readFreshApiKey, regenerateApiKeyAction } from "@/app/(auth)/actions";
import ApiKeyReveal from "./ApiKeyReveal";

const MCP_URL = "https://design-context-production.up.railway.app/sse";

export default async function McpSetupPage() {
  const freshKey = await readFreshApiKey();

  const desktopConfig = `{
  "mcpServers": {
    "design-context": {
      "url": "${MCP_URL}",
      "type": "sse",
      "headers": {
        "Authorization": "Bearer ${freshKey ?? "dk_live_…"}"
      }
    }
  }
}`;

  const codeCmd = `claude mcp add design-context \\
  --transport sse \\
  --header "Authorization: Bearer ${freshKey ?? "dk_live_…"}" \\
  ${MCP_URL}`;

  return (
    <div className="max-w-2xl w-full mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-[20px] font-semibold text-primary tracking-tight">MCP Setup</h1>
        <p className="text-[13px] text-secondary mt-1">
          Install once — all your published design systems become available in Claude.
        </p>
      </div>

      {/* Step 1 — API Key */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-surface-2 flex items-center justify-between">
          <div>
            <div className="text-[14px] font-semibold text-primary">Step 1 — Your API Key</div>
            <div className="text-[12px] text-secondary mt-0.5">
              Identifies you to the MCP server — keep it private
            </div>
          </div>
          <span className="tag tag-purple">Personal</span>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <ApiKeyReveal freshKey={freshKey} />
          <form action={regenerateApiKeyAction}>
            <button className="btn btn-ghost btn-sm">Regenerate key</button>
          </form>
          <p className="text-[12px] text-secondary leading-relaxed">
            ⚠ The plaintext key is shown only once after generation. If lost, regenerate — the old key stops working immediately.
          </p>
        </div>
      </div>

      {/* Step 2 — Add to Claude */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-surface-2">
          <div className="text-[14px] font-semibold text-primary">Step 2 — Add to Claude</div>
          <div className="text-[12px] text-secondary mt-0.5">
            Same MCP URL for everyone — your key tells the server who you are
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border">
          {/* Desktop */}
          <div className="p-5 flex flex-col gap-3">
            <div className="text-[13px] font-medium text-primary">Claude Desktop</div>
            <p className="text-[12px] text-secondary leading-relaxed">
              Settings → Developer → Edit Config → paste:
            </p>
            <pre className="bg-surface-3 border border-border rounded-lg p-3.5 text-[11px] text-green leading-relaxed overflow-x-auto font-mono">
{desktopConfig}
            </pre>
          </div>
          {/* Code */}
          <div className="p-5 flex flex-col gap-3">
            <div className="text-[13px] font-medium text-primary">Claude Code</div>
            <p className="text-[12px] text-secondary leading-relaxed">Run once in your terminal:</p>
            <pre className="bg-surface-3 border border-border rounded-lg p-3.5 text-[11px] text-green leading-relaxed overflow-x-auto font-mono">
{codeCmd}
            </pre>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="card px-5 py-4 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-border-2" />
        <p className="text-[13px] text-secondary flex-1">
          MCP connection status — restart Claude after editing config
        </p>
      </div>
    </div>
  );
}
