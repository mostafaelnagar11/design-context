"use server";

export const maxDuration = 60; // allow up to 60s for Figma API calls

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
  | { ok: true; mode: "variables"; counts: { colors: number; spacing: number; radii: number; skipped: number } }
  | { ok: true; mode: "styles"; counts: { colors: number; typography: number; shadows: number; skipped: number } }
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
  return { ok: true, mode: "variables" as const, counts };
}

// ─── Import Styles (Personal / Pro) ───────────────────────────────────────────

type FigmaStyleMeta = {
  name: string;
  styleType: "FILL" | "TEXT" | "EFFECT" | "GRID";
};

type FigmaFill = { type: string; color?: FigmaColor; opacity?: number };
type FigmaEffect = {
  type: string;
  visible?: boolean;
  color?: FigmaColor;
  radius?: number;
  offset?: { x: number; y: number };
  spread?: number;
};
type FigmaNodeDoc = {
  fills?: FigmaFill[];
  effects?: FigmaEffect[];
  fontSize?: number;
  fontName?: { family: string; style: string };
};

export async function importFromFigmaStylesAction(formData: FormData): Promise<ImportResult> {
  const systemId = String(formData.get("system_id"));
  await assertOwner(systemId);

  const figmaUrl = String(formData.get("figma_url")).trim();
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

  // Helper: fetch with one automatic retry on 429
  async function figmaFetch(url: string): Promise<Response> {
    const headers = { Authorization: `Bearer ${figmaToken}` };
    let res = await fetch(url, { headers, next: { revalidate: 0 } });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? 10) * 1000;
      await new Promise((r) => setTimeout(r, retryAfter || 10_000));
      res = await fetch(url, { headers, next: { revalidate: 0 } });
    }
    return res;
  }

  // 1. Fetch file — depth=2 so style nodes inside frames are included in the styles map
  let fileJson: { styles?: Record<string, FigmaStyleMeta> };
  try {
    const res = await figmaFetch(`https://api.figma.com/v1/files/${fileKey}?depth=2`);
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) return { ok: false, error: "Figma rate limit hit — wait a minute and try again." };
      return { ok: false, error: `Figma API error ${res.status}: ${text.slice(0, 200)}` };
    }
    // Guard against huge files (> 200 MB) that would crash the string parser
    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > 200_000_000) {
      return { ok: false, error: "Figma file is too large to parse (> 200 MB). Try a smaller file or a file with fewer nodes." };
    }
    fileJson = await res.json();
  } catch (e) {
    return { ok: false, error: `Network error: ${String(e)}` };
  }

  const styles = fileJson.styles ?? {};
  const styleEntries = Object.entries(styles)
    .filter(([, s]) => s.styleType !== "GRID")
    .map(([nodeId, s]) => ({ ...s, nodeId }));

  if (!styleEntries.length) {
    const total = Object.keys(styles).length;
    return { ok: false, error: total > 0
      ? "File only has Grid styles — no paint, text, or effect styles to import."
      : "No styles found. Make sure the file has local paint, text, or effect styles (not just styles from a linked library)."
    };
  }

  // 2. Batch-fetch the style nodes to read actual values
  const nodeIdsParam = styleEntries.map((s) => s.nodeId).join(",");
  let nodesJson: { nodes: Record<string, { document: FigmaNodeDoc } | null> };
  try {
    const res = await figmaFetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeIdsParam}`);
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) return { ok: false, error: "Figma rate limit hit — wait a minute and try again." };
      return { ok: false, error: `Figma nodes API error ${res.status}: ${text.slice(0, 200)}` };
    }
    nodesJson = await res.json();
  } catch (e) {
    return { ok: false, error: `Network error: ${String(e)}` };
  }

  // 3. Parse styles → tokens
  type TokenRow = { system_id: string; category: string; token_name: string; token_value: unknown; group_name: string };
  const rows: TokenRow[] = [];
  let skipped = 0;

  for (const style of styleEntries) {
    const nodeData = nodesJson.nodes[style.nodeId];
    if (!nodeData) { skipped++; continue; }
    const doc = nodeData.document;

    const nameParts = style.name.split("/").map(slugify).filter(Boolean);
    const tokenName = nameParts.join("-") || slugify(style.name);
    const groupName = nameParts.length > 1 ? nameParts.slice(0, -1).join("-") : "default";

    if (style.styleType === "FILL") {
      const fill = doc.fills?.find((f) => f.type === "SOLID");
      if (!fill?.color) { skipped++; continue; }
      rows.push({ system_id: systemId, category: "color", token_name: tokenName, token_value: toHex(fill.color), group_name: groupName });

    } else if (style.styleType === "TEXT") {
      const size = doc.fontSize ?? 14;
      const family = doc.fontName?.family ?? "Inter";
      const raw = (doc.fontName?.style ?? "Regular").toLowerCase();
      const weight =
        raw.includes("semi") || raw.includes("demi") ? "semibold" :
        raw.includes("bold") ? "bold" :
        raw.includes("medium") ? "medium" : "regular";
      rows.push({ system_id: systemId, category: "typography", token_name: tokenName, token_value: { size, weight, family }, group_name: groupName });

    } else if (style.styleType === "EFFECT") {
      const shadow = doc.effects?.find(
        (e) => (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") && e.visible !== false
      );
      if (!shadow?.color) { skipped++; continue; }
      const { r, g, b, a } = shadow.color;
      const x = shadow.offset?.x ?? 0;
      const y = shadow.offset?.y ?? 2;
      const blur = shadow.radius ?? 4;
      const spread = shadow.spread ?? 0;
      const rgba = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a.toFixed(2)})`;
      const inset = shadow.type === "INNER_SHADOW" ? "inset " : "";
      const val = `${inset}${x}px ${y}px ${blur}px${spread ? ` ${spread}px` : ""} ${rgba}`;
      rows.push({ system_id: systemId, category: "shadow", token_name: tokenName, token_value: val, group_name: groupName });

    } else {
      skipped++;
    }
  }

  if (!rows.length) {
    return { ok: false, error: "No importable styles found. The file may only have grid styles or unsupported types." };
  }

  // 4. Upsert into Supabase
  const categories = Array.from(new Set(rows.map((r) => r.category)));
  const adminDb = createAdminClient();
  await adminDb.from("tokens").delete().eq("system_id", systemId).in("category", categories);
  const { error: insertErr } = await adminDb.from("tokens").insert(rows);
  if (insertErr) return { ok: false, error: insertErr.message };

  revalidatePath(`/system/${systemId}`);

  return {
    ok: true,
    mode: "styles" as const,
    counts: {
      colors: rows.filter((r) => r.category === "color").length,
      typography: rows.filter((r) => r.category === "typography").length,
      shadows: rows.filter((r) => r.category === "shadow").length,
      skipped,
    },
  };
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
