"use client";

import { useState, useTransition } from "react";
import { addTokenAction } from "../actions";
import { Category, TokenPreview, ValueInput, parseEditValue } from "./ValueInput";

function defaultEditStr(category: Category): string {
  if (category === "color") return "#6366F1";
  if (category === "spacing") return "16";
  if (category === "radii") return "8";
  if (category === "typography")
    return JSON.stringify({ size: 14, weight: "regular", family: "Inter" });
  return "0 2px 8px rgba(0,0,0,0.12)";
}

export function AddTokenRow({
  systemId,
  category,
  onDone,
}: {
  systemId: string;
  category: Category;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [editStr, setEditStr] = useState(defaultEditStr(category));
  const [isPending, startTransition] = useTransition();

  const parsedValue = parseEditValue(category, editStr);

  const handleAdd = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("system_id", systemId);
      fd.set("category", category);
      fd.set("token_name", name.trim());
      fd.set("token_value", editStr);
      await addTokenAction(fd);
      onDone();
    });
  };

  return (
    <div className="flex items-center px-4 py-3 gap-3 bg-surface min-h-[52px]">
      {/* Live preview */}
      <div className="flex-shrink-0">
        <TokenPreview category={category} value={parsedValue} />
      </div>

      {/* Name input */}
      <input
        autoFocus
        placeholder="token-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
          if (e.key === "Escape") onDone();
        }}
        className="bg-surface-3 border border-border focus:border-accent rounded px-2.5 text-[13px] h-8 w-36 outline-none text-primary placeholder:text-muted flex-shrink-0"
      />

      {/* Value input */}
      <div className="flex-1">
        <ValueInput category={category} value={editStr} onChange={setEditStr} />
      </div>

      {/* Actions */}
      <button
        onClick={handleAdd}
        disabled={isPending || !name.trim()}
        className="btn btn-sm btn-primary disabled:opacity-40 flex-shrink-0"
      >
        {isPending ? "…" : "Add"}
      </button>
      <button
        onClick={onDone}
        className="text-muted hover:text-secondary transition-colors flex-shrink-0 text-[16px] leading-none"
      >
        ✕
      </button>
    </div>
  );
}
