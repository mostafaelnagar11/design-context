"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// ─── Figma import ─────────────────────────────────────────────────────────────

type FigmaColor = { r: number; g: number; b: number; a: number };
type FigmaVariable = {
  id: string;
  name: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  variableCollectionId: string;
  valuesByMode: Record<string, unknown>;
  hiddenFromPublishing?: boolean;
};
type FigmaCollection = {
  id: string;
  name: string;
  defaultModeId: string;
};
type FigmaVarsResponse = {
  error?: boolean;
  status?: number;
  meta?: {
    variables: Record<string, FigmaVariable>;
    variableCollections: Record<string, FigmaCollection>;
  };
};

function toHex(c: FigmaColor): string {
  const h = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function extractFileKey(input: string): string | null {
  const m = input.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  if (m) return m[1]!;
  // bare key
  if (/^[a-zA-Z0-9]{10,}$/.test(input.trim())) return input.trim();
  return null;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}

function classifyFloat(name: string, collectionName: string): "spacing" | "radii" {
  const t = `${name} ${collectionName}`.toLowerCase();
  if (/radius|corner|round|rounded|border-radius/.test(t)) return "radii";
  return "spacing";
}

// ─── Figma connection ──────────────────────────────────────────────────────────
// Connection is established via OAuth popup (/api/figma/connect → /api/figma/callback)
// Only disconnect is needed as a server action.

export async function disconnectFigmaAction(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  await admin.from("figma_connections").delete().eq("user_id", user.id);
}

// ─── Import ────────────────────────────────────────────────────────────────────

export type ImportResult =
  | { ok: true; counts: { colors: number; spacing: number; radii: number; skipped: number } }
  | { ok: false; error: string };

export async function importFromFigmaAction(formData: FormData): Promise<ImportResult> {
  const systemId = String(formData.get("system_id"));
  await assertOwner(systemId);

  const figmaUrl = String(formData.get("figma_url")).trim();

  // Read stored token
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not logged in." };

  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("figma_connections")
    .select("access_token")
    .eq("user_id", user.id)
    .maybeSingle();

  const figmaToken = conn?.access_token ?? "";
  if (!figmaToken) return { ok: false, error: "Figma not connected. Connect first." };

  const fileKey = extractFileKey(figmaUrl);
  if (!fileKey) return { ok: false, error: "Could not extract a file key from that URL." };

  // ── Fetch Figma variables ────────────────────────────────────────────────
  let json: FigmaVarsResponse;
  try {
    const res = await fetch(
      `https://api.figma.com/v1/files/${fileKey}/variables/local`,
      { headers: { Authorization: `Bearer ${figmaToken}` }, next: { revalidate: 0 } }
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Figma API error ${res.status}: ${text.slice(0, 200)}` };
    }
    json = await res.json();
  } catch (e) {
    return { ok: false, error: `Network error: ${String(e)}` };
  }

  const variables = json.meta?.variables ?? {};
  const collections = json.meta?.variableCollections ?? {};

  // ── Parse variables → tokens ─────────────────────────────────────────────
  type TokenRow = { system_id: string; category: string; token_name: string; token_value: unknown; group_name: string };
  const rows: TokenRow[] = [];
  let skipped = 0;

  for (const v of Object.values(variables)) {
    if (v.hiddenFromPublishing) { skipped++; continue; }

    const col = collections[v.variableCollectionId];
    const modeId = col?.defaultModeId ?? Object.keys(v.valuesByMode)[0]!;
    const raw = v.valuesByMode[modeId];

    // Resolve aliases (variable references) — skip, we only import concrete values
    if (raw && typeof raw === "object" && "type" in raw && (raw as { type: string }).type === "VARIABLE_ALIAS") {
      skipped++;
      continue;
    }

    const nameParts = v.name.split("/").map(slugify).filter(Boolean);
    const tokenName = nameParts.join("-") || slugify(v.name);
    const groupName = nameParts.length > 1 ? nameParts.slice(0, -1).join("-") : "default";
    const collectionName = col?.name ?? "";

    if (v.resolvedType === "COLOR" && raw && typeof raw === "object") {
      const color = raw as FigmaColor;
      rows.push({ system_id: systemId, category: "color", token_name: tokenName, token_value: toHex(color), group_name: groupName });
    } else if (v.resolvedType === "FLOAT" && typeof raw === "number") {
      const cat = classifyFloat(v.name, collectionName);
      rows.push({ system_id: systemId, category: cat, token_name: tokenName, token_value: raw, group_name: groupName });
    } else {
      skipped++;
    }
  }

  if (!rows.length) {
    return { ok: false, error: "No importable variables found (colors or numbers). Check the file has local variables." };
  }

  // ── Upsert into Supabase ─────────────────────────────────────────────────
  // Delete existing tokens for affected categories, then insert fresh.
  const categories = Array.from(new Set(rows.map((r) => r.category)));
  const adminDb = createAdminClient();

  await adminDb.from("tokens").delete()
    .eq("system_id", systemId)
    .in("category", categories);

  const { error: insertErr } = await adminDb.from("tokens").insert(rows);
  if (insertErr) return { ok: false, error: insertErr.message };

  revalidatePath(`/system/${systemId}`);

  const counts = {
    colors: rows.filter((r) => r.category === "color").length,
    spacing: rows.filter((r) => r.category === "spacing").length,
    radii: rows.filter((r) => r.category === "radii").length,
    skipped,
  };
  return { ok: true, counts };
}

async function assertOwner(systemId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data } = await supabase
    .from("design_systems")
    .select("id")
    .eq("id", systemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) throw new Error("Not found");
}

export async function addTokenAction(formData: FormData) {
  const systemId = String(formData.get("system_id"));
  await assertOwner(systemId);

  const category = String(formData.get("category"));
  const tokenName = String(formData.get("token_name")).trim();
  const tokenValueRaw = String(formData.get("token_value"));
  if (!tokenName) return;

  let tokenValue: unknown = tokenValueRaw;
  try {
    tokenValue = JSON.parse(tokenValueRaw);
  } catch {}

  const admin = createAdminClient();
  await admin.from("tokens").insert({
    system_id: systemId,
    category,
    token_name: tokenName,
    token_value: tokenValue,
    group_name: "default",
  });

  revalidatePath(`/system/${systemId}`);
}

export async function updateTokenAction(formData: FormData) {
  const systemId = String(formData.get("system_id"));
  await assertOwner(systemId);

  const id = String(formData.get("id"));
  const tokenName = String(formData.get("token_name")).trim();
  const tokenValueRaw = String(formData.get("token_value"));
  if (!tokenName) return;

  let tokenValue: unknown = tokenValueRaw;
  try {
    tokenValue = JSON.parse(tokenValueRaw);
  } catch {}

  const admin = createAdminClient();
  await admin
    .from("tokens")
    .update({ token_name: tokenName, token_value: tokenValue })
    .eq("id", id);

  revalidatePath(`/system/${systemId}`);
}

export async function deleteTokenAction(formData: FormData) {
  const systemId = String(formData.get("system_id"));
  await assertOwner(systemId);

  const id = String(formData.get("id"));

  const admin = createAdminClient();
  await admin.from("tokens").delete().eq("id", id);

  revalidatePath(`/system/${systemId}`);
}
