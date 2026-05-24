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

/**
 * Fast path: call Figma's dedicated /styles endpoint which returns only style
 * metadata (name, style_type, node_id) — no document tree, no timeout risk.
 * Works for files whose styles are published to a team library (Personal / Pro).
 * Returns a nodeId→StyleMeta map, or null when the endpoint returns nothing.
 */
async function fetchPublishedStylesMeta(
  fileKey: string,
  token: string
): Promise<Record<string, FigmaStyleMeta> | null> {
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/styles`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      error?: boolean;
      meta?: {
        styles: Array<{
          node_id: string;
          name: string;
          style_type: "FILL" | "TEXT" | "EFFECT" | "GRID";
        }>;
      };
    };
    const list = json.meta?.styles;
    if (!list?.length) return null;
    const map: Record<string, FigmaStyleMeta> = {};
    for (const s of list) {
      if (s.node_id) map[s.node_id] = { name: s.name, styleType: s.style_type };
    }
    return Object.keys(map).length ? map : null;
  } catch {
    return null;
  }
}

/**
 * Slow-path fallback: stream-parse a Figma /nodes response to extract the
 * page-level styles registry without ever buffering the full JSON in memory.
 *
 * The registry lives at nodes[PAGE_ID].styles and its entries are the only
 * place in the response where "styleType" appears as an object key.  We scan
 * incoming chunks for that string, backtrack to the enclosing "styles":{,
 * then extract the complete JSON object — and immediately cancel the stream.
 *
 * This avoids both the V8 string-length overflow (no full buffer) and saves
 * any remaining download time once the styles are extracted.
 */
async function extractStylesFromNodeStream(
  res: Response,
): Promise<Record<string, FigmaStyleMeta>> {
  // No ReadableStream support — fall back to buffered parse
  if (!res.body) {
    try {
      const json = (await res.json()) as {
        nodes: Record<string, { styles?: Record<string, FigmaStyleMeta> } | null>;
      };
      const result: Record<string, FigmaStyleMeta> = {};
      for (const node of Object.values(json.nodes ?? {})) {
        if (node?.styles) Object.assign(result, node.styles);
      }
      return result;
    } catch {
      return {};
    }
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const TAIL_MAX = 5 * 1024 * 1024; // 5 MB rolling window

  let tail = "";
  // Once "styleType" is spotted we stop trimming tail so the object stays intact
  let lockedForExtraction = false;

  /** Find the matching closing brace; returns the complete JSON string or null. */
  function extractObject(s: string): string | null {
    if (!s.startsWith("{")) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i]!;
      if (esc) { esc = false; continue; }
      if (c === "\\" && inStr) { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { if (--depth === 0) return s.slice(0, i + 1); }
    }
    return null; // object not yet complete
  }

  /**
   * Try to parse the page-level styles map out of the current tail.
   * Returns the map when fully extracted, null when more data is needed.
   */
  function tryExtract(): Record<string, FigmaStyleMeta> | null {
    let search = 0;
    while (true) {
      const idx = tail.indexOf('"styleType"', search);
      if (idx === -1) return null;

      // Backtrack to the nearest preceding "styles":{
      const before = tail.slice(0, idx);
      const sKey = before.lastIndexOf('"styles"');
      if (sKey === -1) { search = idx + 1; continue; }

      const afterKey = tail.slice(sKey + 8); // skip `"styles"`
      const colon = afterKey.indexOf(":");
      if (colon === -1) { search = idx + 1; continue; }

      const rest = afterKey.slice(colon + 1).trimStart();
      if (!rest.startsWith("{")) { search = idx + 1; continue; }

      const objStr = extractObject(rest);
      if (objStr === null) return null; // incomplete — need more data

      try {
        const parsed = JSON.parse(objStr) as Record<string, unknown>;
        const first = Object.values(parsed)[0];
        if (first && typeof first === "object" && "styleType" in first) {
          return parsed as Record<string, FigmaStyleMeta>;
        }
      } catch { /* malformed — keep searching */ }

      search = idx + 1;
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      tail += decoder.decode(value, { stream: true });

      if (!lockedForExtraction && tail.includes('"styleType"')) {
        lockedForExtraction = true;
      }

      const result = tryExtract();
      if (result) {
        reader.cancel().catch(() => {});
        return result;
      }

      // Trim only while we haven't spotted styleType yet (never trim a partial object)
      if (!lockedForExtraction && tail.length > TAIL_MAX) {
        const lastS = tail.lastIndexOf('"styles"');
        const trimAt = lastS > 0 ? lastS : tail.length - TAIL_MAX;
        tail = tail.slice(Math.max(0, trimAt));
      }
    }
  } catch { /* stream read error */ } finally {
    reader.cancel().catch(() => {});
  }

  return {};
}

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

  // ── Step 1a: lightweight depth=1 file fetch ──────────────────────────────
  // Gives us page IDs and may already contain the root styles map.
  let stylesMap: Record<string, FigmaStyleMeta> = {};
  let pageIds: string[] = [];
  const pageNames: Record<string, string> = {};

  try {
    const res = await figmaFetch(`https://api.figma.com/v1/files/${fileKey}?depth=1`);
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) return { ok: false, error: "Figma rate limit hit — wait a minute and try again." };
      return { ok: false, error: `Figma API error ${res.status}: ${text.slice(0, 200)}` };
    }
    const fileJson: { styles?: Record<string, FigmaStyleMeta>; document?: { children?: { id: string; name: string }[] } } = await res.json();
    stylesMap = fileJson.styles ?? {};
    const pages = fileJson.document?.children ?? [];
    pageIds = pages.map((p) => p.id);
    for (const p of pages) pageNames[p.id] = p.name;
  } catch (e) {
    return { ok: false, error: `Network error: ${String(e)}` };
  }

  // ── Step 1b: fast path — dedicated /styles endpoint ──────────────────────
  // Returns published-style metadata with node IDs in a tiny response.
  // Handles large files (e.g. 1000+ component UI kits) without timeout risk.
  if (Object.keys(stylesMap).length === 0) {
    const published = await fetchPublishedStylesMeta(fileKey, figmaToken);
    if (published) stylesMap = published;
  }

  // ── Step 1c: stream-parse fallback ───────────────────────────────────────
  // For files with unpublished local styles the /styles endpoint returns nothing.
  // We fetch pages one-at-a-time, stream-parsing each response to extract the
  // page-level styles registry without buffering the full JSON.
  if (Object.keys(stylesMap).length === 0 && pageIds.length > 0) {
    const STYLE_KEYWORDS = /style|foundation|color|colour|token|typography|text|effect|shadow|radius|spacing/i;
    const sorted = [...pageIds].sort((a, b) => {
      const aMatch = STYLE_KEYWORDS.test(pageNames[a] ?? "") ? 1 : 0;
      const bMatch = STYLE_KEYWORDS.test(pageNames[b] ?? "") ? 1 : 0;
      return bMatch - aMatch;
    });

    for (const pid of sorted) {
      try {
        const res = await figmaFetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${pid}`);
        if (!res.ok) continue;
        const extracted = await extractStylesFromNodeStream(res);
        if (Object.keys(extracted).length > 0) {
          Object.assign(stylesMap, extracted);
          break;
        }
      } catch { continue; }
    }
  }

  const styleEntries = Object.entries(stylesMap)
    .filter(([, s]) => s.styleType !== "GRID")
    .map(([nodeId, s]) => ({ ...s, nodeId }));

  if (!styleEntries.length) {
    const total = Object.keys(stylesMap).length;
    return { ok: false, error: total > 0
      ? "File only has Grid styles — no paint, text, or effect styles to import."
      : "No styles found. Make sure the file has local paint, text, or effect styles. If your styles come from a linked library, open the library file itself and import from there."
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
