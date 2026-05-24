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
    <div className="flex items-center px-3.5 py-2 gap-2.5 bg-shell border-b-2 border-ink min-h-[42px]">
      {/* Live preview of new value */}
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
        className="border border-[#C8C4B8] bg-white px-1.5 text-[10px] h-6 w-32 outline-none focus:border-ink flex-shrink-0"
      />

      {/* Value input */}
      <div className="flex-1">
        <ValueInput category={category} value={editStr} onChange={setEditStr} />
      </div>

      {/* Actions */}
      <button
        onClick={handleAdd}
        disabled={isPending || !name.trim()}
        className="text-[8px] border border-ink px-2.5 py-1 hover:bg-ink hover:text-shell disabled:opacity-40 transition-colors flex-shrink-0"
      >
        {isPending ? "…" : "Add"}
      </button>
      <button
        onClick={onDone}
        className="text-[9px] text-ink-mute hover:text-ink flex-shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
