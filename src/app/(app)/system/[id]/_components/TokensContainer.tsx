"use client";

import { useState } from "react";
import { TokenRow } from "./TokenRow";
import { AddTokenRow } from "./AddTokenRow";
import { Category } from "./ValueInput";

type Token = {
  id: string;
  token_name: string;
  token_value: unknown;
  group_name: string | null;
};

type Group = { name: string; tokens: Token[] };

export function TokensContainer({
  systemId,
  category,
  label,
  total,
  groups,
}: {
  systemId: string;
  category: Category;
  label: string;
  total: number;
  groups: Group[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="sec-label">{label}</span>
          <span className="text-[11px] text-muted">{total}</span>
        </div>
        {!adding && (
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
            + Add Token
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-surface-2">
            <span className="sec-label">New Token</span>
          </div>
          <AddTokenRow
            systemId={systemId}
            category={category}
            onDone={() => setAdding(false)}
          />
        </div>
      )}

      {/* Empty state */}
      {total === 0 && !adding && (
        <div className="border border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-3 text-center">
          <div className="text-[13px] text-secondary">No {label.toLowerCase()} tokens yet</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
            + Add your first token
          </button>
        </div>
      )}

      {/* Token groups */}
      {groups.map((g) => (
        <div key={g.name} className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-surface-2 flex items-center justify-between">
            <span className="text-[12px] font-medium text-primary">{g.name}</span>
            <span className="text-[11px] text-muted">{g.tokens.length}</span>
          </div>
          {g.tokens.map((t) => (
            <TokenRow
              key={t.id}
              token={t}
              category={category}
              systemId={systemId}
            />
          ))}
        </div>
      ))}
    </>
  );
}
