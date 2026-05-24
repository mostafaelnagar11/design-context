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
      <aside className="w-[196px] border-r-2 border-ink bg-sidebar py-3 flex flex-col gap-[1px]">
        <div className="px-3.5 py-2 text-[8px] tracking-[2px] uppercase text-ink-mute">
          Workspace
        </div>
        <div className="px-3.5 py-2 text-[10px] bg-ink text-shell">Design Systems</div>
        <Link href="/mcp-setup" className="px-3.5 py-2 text-[10px]">MCP Setup</Link>
        <div className="h-px bg-[#C8C4B8] my-1.5 mx-3.5" />
        <div className="px-3.5 py-2 text-[8px] tracking-[2px] uppercase text-ink-mute">
          Systems
        </div>
        {systems?.length ? (
          systems.map((s) => (
            <Link
              key={s.id}
              href={`/system/${s.id}`}
              className="px-5 py-2 text-[10px]"
            >
              {s.name}
            </Link>
          ))
        ) : (
          <div className="px-3.5 py-2 text-[10px] italic text-mute">No systems yet</div>
        )}
      </aside>
      <main className="flex-1 p-7 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Design Systems</h1>
            <div className="text-[10px] text-soft mt-1">
              {systems?.length ?? 0} systems
            </div>
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
                className="border-2 border-ink overflow-hidden bg-shell"
              >
                <div className="h-20 bg-[#D0CEC6] border-b-2 border-ink relative" />
                <div className="p-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold">{s.name}</div>
                    <div className="text-[9px] text-ink-mute mt-0.5 capitalize">
                      {s.status}
                    </div>
                  </div>
                  <span
                    className={`tag ${
                      s.status === "published" ? "tag-green" : "tag-orange"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed border-[#B0ADA6] bg-[#EAE7E0] flex flex-col items-center justify-center gap-3 p-16 text-center">
            <div className="w-12 h-12 border-2 border-[#B0ADA6] grid place-items-center text-xl text-[#B0ADA6]">
              ◈
            </div>
            <div className="text-[13px] font-bold text-soft">No design systems yet</div>
            <div className="text-[10px] text-ink-mute max-w-xs leading-relaxed">
              Create your first system to start populating tokens.
            </div>
            <form action={createSystemAction} className="mt-2">
              <button className="btn btn-primary">+ Create Design System</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
