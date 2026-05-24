import { createClient } from "@/lib/supabase/server";

type Category = "color" | "typography" | "spacing" | "radii" | "shadow";

export default async function TokenList({
  systemId,
  category,
  label,
  renderValue,
}: {
  systemId: string;
  category: Category;
  label: string;
  renderValue: (value: unknown) => React.ReactNode;
}) {
  const supabase = createClient();
  const { data: tokens } = await supabase
    .from("tokens")
    .select("id, token_name, token_value, group_name")
    .eq("system_id", systemId)
    .eq("category", category)
    .order("token_name");

  const groups = (tokens ?? []).reduce<Record<string, typeof tokens>>(
    (acc, t) => {
      const g = t.group_name ?? "default";
      acc[g] = acc[g] ?? [];
      acc[g]!.push(t);
      return acc;
    },
    {}
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="sec-label border-0 p-0">
          {label} — {tokens?.length ?? 0} TOKENS
        </div>
        <button className="btn btn-sm" disabled>+ Add Token</button>
      </div>

      {tokens?.length === 0 && (
        <div className="border-2 border-dashed border-[#B0ADA6] bg-[#EAE7E0] p-10 text-center text-[10px] text-ink-mute">
          No {label.toLowerCase()} yet — import or add manually.
        </div>
      )}

      {Object.entries(groups).map(([group, list]) => (
        <div key={group} className="border-2 border-ink overflow-hidden">
          <div className="px-3.5 py-2 bg-sidebar border-b border-[#D0CEC6] text-[9px] tracking-[1.5px] uppercase flex items-center justify-between">
            <span>{group}</span>
            <span className="text-ink-mute">{list?.length} tokens</span>
          </div>
          {list?.map((t) => (
            <div
              key={t.id}
              className="flex items-center px-3.5 py-2 border-b border-[#EDEAE3] gap-2.5 last:border-b-0"
            >
              {renderValue(t.token_value)}
              <div className="text-[10px] flex-1">{t.token_name}</div>
              <div className="text-[9px] text-ink-mute font-mono">
                {typeof t.token_value === "string"
                  ? t.token_value
                  : JSON.stringify(t.token_value)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
