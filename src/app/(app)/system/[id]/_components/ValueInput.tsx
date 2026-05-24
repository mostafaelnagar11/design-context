"use client";

export type Category = "color" | "typography" | "spacing" | "radii" | "shadow";

/** Convert a raw token_value to the editable string form */
export function valueToEditString(category: Category, value: unknown): string {
  if (category === "typography") return JSON.stringify(value ?? {});
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? "");
}

/** Parse the edit string back to the storable value */
export function parseEditValue(category: Category, raw: string): unknown {
  if (category === "spacing" || category === "radii") return Number(raw) || 0;
  if (category === "typography") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

/** Human-readable display of a stored value */
export function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return `${value}px`;
  return JSON.stringify(value);
}

/** Rendered token preview swatch */
export function TokenPreview({
  category,
  value,
}: {
  category: Category;
  value: unknown;
}) {
  if (category === "color") {
    return (
      <div
        className="w-6 h-6 rounded border border-white/10 flex-shrink-0"
        style={{ background: typeof value === "string" ? value : "#666" }}
      />
    );
  }
  if (category === "spacing") {
    const n = typeof value === "number" ? value : 0;
    return (
      <div className="flex items-center h-6 flex-shrink-0 w-10">
        <div
          className="h-2.5 bg-border-2 rounded-sm"
          style={{ width: Math.min(Math.max(n, 4), 40) }}
        />
      </div>
    );
  }
  if (category === "radii") {
    const n = typeof value === "number" ? value : 0;
    return (
      <div
        className="w-6 h-6 bg-surface-3 border border-border flex-shrink-0"
        style={{ borderRadius: Math.min(n, 12) }}
      />
    );
  }
  if (category === "shadow") {
    return (
      <div
        className="w-6 h-6 bg-surface-2 border border-border rounded flex-shrink-0"
        style={{ boxShadow: typeof value === "string" ? value : undefined }}
      />
    );
  }
  if (category === "typography") {
    const t = (value ?? {}) as { size?: number; weight?: string };
    return (
      <div
        className="w-6 h-6 grid place-items-center text-primary flex-shrink-0"
        style={{
          fontSize: Math.min(t.size ?? 14, 16),
          fontWeight:
            t.weight === "bold" ? 700 : t.weight === "semibold" ? 600 : t.weight === "medium" ? 500 : 400,
        }}
      >
        Aa
      </div>
    );
  }
  return <div className="w-6 h-6 flex-shrink-0" />;
}

const inputCls = "bg-surface-3 border border-border focus:border-accent rounded px-2 text-[12px] font-mono h-7 outline-none text-primary placeholder:text-muted";

/** Inline editor — rendered when a row is in edit mode */
export function ValueInput({
  category,
  value,
  onChange,
}: {
  category: Category;
  value: string;
  onChange: (v: string) => void;
}) {
  if (category === "color") {
    const hex = value.startsWith("#") ? value : "#000000";
    return (
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded border border-border cursor-pointer p-0 bg-transparent flex-shrink-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-24 ${inputCls}`}
        />
      </div>
    );
  }

  if (category === "spacing" || category === "radii") {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-16 ${inputCls}`}
        />
        <span className="text-[12px] text-muted">px</span>
      </div>
    );
  }

  if (category === "typography") {
    let obj: Record<string, unknown> = {};
    try { obj = JSON.parse(value); } catch {}

    const update = (key: string, v: unknown) =>
      onChange(JSON.stringify({ ...obj, [key]: v }));

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted">sz</span>
          <input
            type="number"
            value={String(obj.size ?? "")}
            placeholder="14"
            onChange={(e) => update("size", Number(e.target.value))}
            className={`w-14 ${inputCls}`}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted">wt</span>
          <select
            value={String(obj.weight ?? "regular")}
            onChange={(e) => update("weight", e.target.value)}
            className={`${inputCls} pr-2`}
          >
            <option value="regular">regular</option>
            <option value="medium">medium</option>
            <option value="semibold">semibold</option>
            <option value="bold">bold</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted">ff</span>
          <input
            type="text"
            value={String(obj.family ?? "")}
            placeholder="Inter"
            onChange={(e) => update("family", e.target.value)}
            className={`w-24 ${inputCls}`}
          />
        </div>
      </div>
    );
  }

  // shadow + fallback
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-52 ${inputCls}`}
    />
  );
}
