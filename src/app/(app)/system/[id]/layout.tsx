export const maxDuration = 60;

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
  { slug: "colors",     label: "Colors",      icon: "●" },
  { slug: "typography", label: "Typography",   icon: "T" },
  { slug: "spacing",    label: "Spacing",      icon: "↔" },
  { slug: "radii",      label: "Radii",        icon: "◌" },
  { slug: "shadows",    label: "Shadows",      icon: "▣" },
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
      {/* System header */}
      <div className="h-12 border-b border-border bg-surface flex items-center px-5 gap-3 shrink-0">
        <Link href="/dashboard" className="text-[12px] text-secondary hover:text-primary transition-colors">
          ← Dashboard
        </Link>
        <div className="w-px h-4 bg-border" />
        <div className="text-[14px] font-medium text-primary">{system.name}</div>
        <span className={`tag ${isPublished ? "tag-green" : "tag-amber"}`}>
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
          <button className={`btn btn-sm ${isPublished ? "btn-ghost" : "btn-primary"}`}>
            {isPublished ? "Unpublish" : "Publish →"}
          </button>
        </form>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 border-r border-border bg-surface flex flex-col py-4 shrink-0">
          <div className="px-4 mb-2">
            <span className="sec-label">Tokens</span>
          </div>
          {TABS.map((t) => (
            <Link
              key={t.slug}
              href={`/system/${system.id}/${t.slug}`}
              className="nav-item mx-2 justify-between"
            >
              <span className="flex items-center gap-2.5">
                <span className="text-[13px] w-4 text-center">{t.icon}</span>
                {t.label}
              </span>
              <span className="text-[11px] text-muted">
                {countByCategory[categoryFor(t.slug)] ?? 0}
              </span>
            </Link>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 p-7 flex flex-col gap-5 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
