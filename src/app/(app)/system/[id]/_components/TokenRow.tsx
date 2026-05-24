"use client";

import { useRef, useState, useTransition } from "react";
import { updateTokenAction, deleteTokenAction } from "../actions";
import {
  Category,
  TokenPreview,
  ValueInput,
  displayValue,
  valueToEditString,
  parseEditValue,
} from "./ValueInput";

type Token = {
  id: string;
  token_name: string;
  token_value: unknown;
  group_name: string | null;
};

export function TokenRow({
  token,
  category,
  systemId,
}: {
  token: Token;
  category: Category;
  systemId: string;
}) {
  const [name, setName] = useState(token.token_name);
  const [editStr, setEditStr] = useState(valueToEditString(category, token.token_value));
  const [editingName, setEditingName] = useState(false);
  const [editingValue, setEditingValue] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deleted, setDeleted] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const parsedValue = parseEditValue(category, editStr);

  const save = (nextName: string, nextEditStr: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", token.id);
      fd.set("system_id", systemId);
      fd.set("token_name", nextName);
      fd.set("token_value", nextEditStr);
      await updateTokenAction(fd);
    });
  };

  const commitName = () => {
    setEditingName(false);
    if (name.trim()) save(name.trim(), editStr);
    else setName(token.token_name);
  };

  const commitValue = () => {
    setEditingValue(false);
    save(name, editStr);
  };

  const handleDelete = () => {
    setDeleted(true);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", token.id);
      fd.set("system_id", systemId);
      await deleteTokenAction(fd);
    });
  };

  if (deleted) return null;

  return (
    <div
      className={`group flex items-center px-4 py-2.5 border-b border-border gap-3 last:border-b-0 min-h-[44px] hover:bg-surface-2 transition-colors ${
        isPending ? "opacity-40" : ""
      }`}
    >
      {/* Preview swatch — click to edit value */}
      <button
        type="button"
        onClick={() => { setEditingValue(true); setEditingName(false); }}
        className="flex-shrink-0 focus:outline-none"
        tabIndex={-1}
      >
        <TokenPreview category={category} value={parsedValue} />
      </button>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {editingName ? (
          <input
            ref={nameRef}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") nameRef.current?.blur();
              if (e.key === "Escape") { setName(token.token_name); setEditingName(false); }
            }}
            className="bg-surface-3 border border-border focus:border-accent rounded px-2 text-[13px] h-7 w-full outline-none text-primary"
          />
        ) : (
          <div
            className="text-[13px] text-primary cursor-text truncate"
            onClick={() => { setEditingName(true); setEditingValue(false); }}
            title="Click to rename"
          >
            {name}
          </div>
        )}
      </div>

      {/* Value display / editor */}
      <div className="flex-shrink-0">
        {editingValue ? (
          <div className="flex items-center gap-2">
            <ValueInput category={category} value={editStr} onChange={setEditStr} />
            <button
              onMouseDown={commitValue}
              className="btn btn-sm btn-primary"
            >
              Save
            </button>
            <button
              onMouseDown={() => {
                setEditStr(valueToEditString(category, token.token_value));
                setEditingValue(false);
              }}
              className="text-[14px] text-muted hover:text-secondary transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <div
            className="text-[12px] text-secondary font-mono cursor-text max-w-[180px] truncate hover:text-primary transition-colors"
            onClick={() => { setEditingValue(true); setEditingName(false); }}
            title="Click to edit value"
          >
            {displayValue(parsedValue)}
          </div>
        )}
      </div>

      {/* Delete — visible on group hover */}
      <button
        type="button"
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 ml-1 text-muted hover:text-red text-[16px] w-5 flex-shrink-0 transition-all leading-none"
        title="Delete token"
      >
        ×
      </button>
    </div>
  );
}
