import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import ws from "ws";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  }
);

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export type UserRow = { id: string; email: string };

export type DesignSystem = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type Token = {
  category: string;
  group_name: string | null;
  token_name: string;
  token_value: unknown;
};

export async function getUserByApiKey(rawKey: string): Promise<UserRow | null> {
  const hashed = hashKey(rawKey);
  const { data } = await supabase
    .from("users")
    .select("id, email")
    .eq("hashed_api_key", hashed)
    .maybeSingle();
  return data ?? null;
}

export async function getPublishedSystems(userId: string): Promise<DesignSystem[]> {
  const { data } = await supabase
    .from("design_systems")
    .select("id, name, slug, status")
    .eq("user_id", userId)
    .eq("status", "published");
  return data ?? [];
}

export async function getTokensForSystem(systemId: string): Promise<Token[]> {
  const { data } = await supabase
    .from("tokens")
    .select("category, group_name, token_name, token_value")
    .eq("system_id", systemId)
    .order("category")
    .order("token_name");
  return data ?? [];
}
