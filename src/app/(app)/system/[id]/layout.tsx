import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  publishSystemAction,
  unpublishSystemAction,
} from "../../dashboard/actions";
import { FigmaImportButton } from "./_components/FigmaImportButton";

const TABS = [
  { slug: "colors", label: "Colors", icon: "●" },
  { slug: "typography", label: "Typography", icon: "T" },
  { slug: "spacing", label: "Spacing", icon: "↔" },
  { slug: "radii", label: "Radii", icon: "◌" },
  { slug: "shadows", label: "Shadows", icon: "▣" },
] as const;

export default async function SystemLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: system } = await supabase
    .from("design_systems")
    .select("id, name, status")
    .eq("id", params.id)
    .single();
  if (!system) notFound();

  // Check Figma connection
  const admin = createAdminClient();
  const { data: figmaConn } = user
    ? await admin.from("figma_connections").select("figma_email").eq("user_id", user.id).maybeSingle()
    : { data: null };

  const { data: counts } = await supabase
    .from("tokens")
    .select("category", { count: "exact", head: false })
    .eq("system_id", params.id);

  const countByCategory = (counts ?? []).reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    },
    {}
  );
  const categoryFor = (s: string) =>
    s === "colors" ? "color" : s === "radii" ? "radii" : s === "shadows" ? "shadow" : s;

  const isPublished = system.status === "published";

  return (
    <div className="flex-1 flex flex-col">
      <div className="h-12 border-b-2 border-ink flex items-center px-5 gap-3 bg-panel">
        <Link href="/dashboard" className="text-[10px] text-soft">← Dashboard</Link>
        <div className="text-[12px] font-bold ml-2">{system.name}</div>
        <span
          className={`tag ${isPublished ? "tag-green" : "tag-orange"} ml-1`}
        >
          {system.status}
        </span>
        <div className="flex-1" />
        <FigmaImportButton
          systemId={system.id}
          isConnected={!!figmaConn}
          figmaEmail={figmaConn?.figma_email}
        />
        <form action={isPublished ? unpublishSystemAction : publishSystemAction}>
          <input type="hidden" name="id" value={system.id} />
          <button
            className={`btn btn-sm ${isPublished ? "" : "btn-primary"}`}
          >
            {isPublished ? "Unpublish" : "Publish →"}
          </button>
        </form>
      </div>
      <div className="flex-1 flex">
        <aside className="w-[196px] border-r-2 border-ink bg-sidebar py-3 flex flex-col">
          <div className="px-3.5 py-2 text-[8px] tracking-[2px] uppercase text-ink-mute">
            Tokens
          </div>
          {TABS.map((t) => (
            <Link
              key={t.slug}
              href={`/system/${system.id}/${t.slug}`}
              className="px-3.5 py-2 text-[10px] flex items-center gap-2"
            >
              <span className="w-3.5 h-3.5 border-[1.5px] border-current grid place-items-center text-[7px]">
                {t.icon}
              </span>
              {t.label} · {countByCategory[categoryFor(t.slug)] ?? 0}
            </Link>
          ))}
        </aside>
        <main className="flex-1 p-7 flex flex-col gap-4 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
