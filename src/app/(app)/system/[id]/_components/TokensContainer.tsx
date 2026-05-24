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
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="sec-label border-0 p-0">
          {label} — {total} TOKEN{total !== 1 ? "S" : ""}
        </div>
        {!adding && (
          <button
            className="btn btn-sm"
            onClick={() => setAdding(true)}
          >
            + Add Token
          </button>
        )}
      </div>

      {/* Add form — shown inline above groups */}
      {adding && (
        <div className="border-2 border-ink overflow-hidden">
          <div className="px-3.5 py-2 bg-sidebar border-b border-[#D0CEC6] text-[9px] tracking-[1.5px] uppercase text-ink-mute">
            New Token
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
        <div className="border-2 border-dashed border-[#B0ADA6] bg-[#EAE7E0] p-10 text-center text-[10px] text-ink-mute">
          No {label.toLowerCase()} tokens yet — click Add Token to start.
        </div>
      )}

      {/* Token groups */}
      {groups.map((g) => (
        <div key={g.name} className="border-2 border-ink overflow-hidden">
          <div className="px-3.5 py-2 bg-sidebar border-b border-[#D0CEC6] text-[9px] tracking-[1.5px] uppercase flex items-center justify-between">
            <span>{g.name}</span>
            <span className="text-ink-mute">{g.tokens.length} tokens</span>
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
