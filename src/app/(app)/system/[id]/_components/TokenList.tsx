import { createClient } from "@/lib/supabase/server";
import { TokensContainer } from "./TokensContainer";
import { Category } from "./ValueInput";

export default async function TokenList({
  systemId,
  category,
  label,
}: {
  systemId: string;
  category: Category;
  label: string;
}) {
  const supabase = createClient();
  const { data: tokens } = await supabase
    .from("tokens")
    .select("id, token_name, token_value, group_name")
    .eq("system_id", systemId)
    .eq("category", category)
    .order("token_name");

  const list = tokens ?? [];

  // Group by group_name
  const groupMap: Record<string, typeof list> = {};
  for (const t of list) {
    const g = t.group_name ?? "default";
    groupMap[g] = groupMap[g] ?? [];
    groupMap[g]!.push(t);
  }
  const groups = Object.entries(groupMap).map(([name, toks]) => ({
    name,
    tokens: toks,
  }));

  return (
    <TokensContainer
      systemId={systemId}
      category={category}
      label={label}
      total={list.length}
      groups={groups}
    />
  );
}
