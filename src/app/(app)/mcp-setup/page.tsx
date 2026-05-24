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
    <main className="flex-1 p-7 flex flex-col gap-4 overflow-y-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight">MCP Setup</h1>
        <p className="text-[10px] text-soft mt-1">
          Install once — all your published design systems become available in Claude.
        </p>
      </div>

      <section className="border-2 border-ink">
        <header className="px-5 py-3 border-b-2 border-ink bg-panel flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold tracking-wider">
              STEP 1 — Your API Key
            </div>
            <div className="text-[9px] text-ink-mute mt-0.5">
              Identifies you to the MCP server — keep it private
            </div>
          </div>
          <span className="tag border-mute text-ink-mute">PERSONAL</span>
        </header>
        <div className="p-4 flex flex-col gap-3 bg-shell">
          <ApiKeyReveal freshKey={freshKey} />
          <form action={regenerateApiKeyAction}>
            <button className="btn btn-ghost btn-sm">Regenerate</button>
          </form>
          <div className="text-[9px] text-ink-mute leading-relaxed">
            ⚠ Plaintext key is shown only once after generation. If lost, regenerate —
            the old key stops working immediately.
          </div>
        </div>
      </section>

      <section className="border-2 border-ink">
        <header className="px-5 py-3 border-b-2 border-ink bg-panel">
          <div className="text-[11px] font-bold tracking-wider">
            STEP 2 — Add to Claude Config
          </div>
          <div className="text-[9px] text-ink-mute mt-0.5">
            Same MCP URL for everyone — your key tells the server who you are
          </div>
        </header>
        <div className="grid grid-cols-2">
          <div className="p-4 border-r border-[#D0CEC6] flex flex-col gap-2">
            <div className="text-[11px] font-bold">Claude Desktop</div>
            <div className="text-[9px] text-soft">
              Settings → Developer → Edit Config — paste:
            </div>
            <pre className="bg-ink text-[#90D490] p-3 text-[9px] leading-relaxed overflow-x-auto">
{desktopConfig}
            </pre>
          </div>
          <div className="p-4 flex flex-col gap-2">
            <div className="text-[11px] font-bold">Claude Code</div>
            <div className="text-[9px] text-soft">Run once in your terminal:</div>
            <pre className="bg-ink text-[#90D490] p-3 text-[9px] leading-relaxed overflow-x-auto">
{codeCmd}
            </pre>
          </div>
        </div>
      </section>

      <section className="border-2 border-ink p-4 bg-panel flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-[#C8C4B8] border-2 border-ink-mute" />
        <div className="text-[10px] text-soft flex-1">
          MCP connection status — restart Claude after editing config
        </div>
      </section>
    </main>
  );
}
