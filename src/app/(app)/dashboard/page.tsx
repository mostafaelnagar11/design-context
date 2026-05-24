import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createSystemAction } from "./actions";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: systems } = await supabase
    .from("design_systems")
    .select("id, name, status, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="flex-1 flex">
      {/* Sidebar */}
      <aside className="w-52 border-r border-border bg-surface flex flex-col py-4 shrink-0">
        <div className="px-4 mb-3">
          <span className="sec-label">Workspace</span>
        </div>
        <Link href="/dashboard" className="nav-item-active mx-2">
          <span className="text-[14px]">▦</span> Design Systems
        </Link>
        <Link href="/mcp-setup" className="nav-item mx-2">
          <span className="text-[14px]">⌘</span> MCP Setup
        </Link>

        {systems && systems.length > 0 && (
          <>
            <div className="px-4 mt-5 mb-2">
              <span className="sec-label">Systems</span>
            </div>
            {systems.map((s) => (
              <Link
                key={s.id}
                href={`/system/${s.id}`}
                className="nav-item mx-2 truncate"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-border-2 shrink-0" />
                <span className="truncate">{s.name}</span>
              </Link>
            ))}
          </>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 flex flex-col gap-6 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-primary tracking-tight">Design Systems</h1>
            <p className="text-[13px] text-secondary mt-0.5">
              {systems?.length ?? 0} system{(systems?.length ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <form action={createSystemAction}>
            <button className="btn btn-primary">+ New System</button>
          </form>
        </div>

        {systems?.length ? (
          <div className="grid grid-cols-3 gap-3">
            {systems.map((s) => (
              <Link
                key={s.id}
                href={`/system/${s.id}`}
                className="card-hover flex flex-col overflow-hidden"
              >
                {/* Preview swatch */}
                <div className="h-24 bg-surface-3 border-b border-border" />
                <div className="p-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-primary truncate">{s.name}</div>
                    <div className="text-[12px] text-secondary mt-0.5 capitalize">{s.status}</div>
                  </div>
                  <span className={`tag shrink-0 ${s.status === "published" ? "tag-green" : "tag-amber"}`}>
                    {s.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[320px]">
            <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-[22px] text-muted">
              ◈
            </div>
            <div className="text-center">
              <div className="text-[15px] font-medium text-primary">No design systems yet</div>
              <div className="text-[13px] text-secondary mt-1 max-w-xs leading-relaxed">
                Create your first system to start populating tokens and connecting to Claude.
              </div>
            </div>
            <form action={createSystemAction}>
              <button className="btn btn-primary">+ Create Design System</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
