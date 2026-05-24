"use client";

import { useEffect, useState } from "react";
import { clearFreshApiKey } from "@/app/(auth)/actions";

export default function ApiKeyReveal({ freshKey }: { freshKey: string | null }) {
  const [key, setKey] = useState<string | null>(freshKey);
  const [revealed, setRevealed] = useState(false);

  // Store key in local state so it survives the page revalidation
  // that fires after clearFreshApiKey() (a Server Action) completes.
  useEffect(() => {
    if (freshKey) {
      setKey(freshKey);
      void clearFreshApiKey();
    }
  }, [freshKey]);

  const masked = "dk_live_••••••••••••••••••••••••••••••••";
  const display = key ? (revealed ? key : masked) : masked;

  async function copy() {
    if (!key) return;
    await navigator.clipboard.writeText(key);
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-10 border-2 border-ink bg-ink text-[#90D490] font-mono text-[11px] px-3.5 flex items-center tracking-wider">
        {display}
      </div>
      {key ? (
        <>
          <button type="button" onClick={() => setRevealed((r) => !r)} className="btn">
            {revealed ? "Hide" : "Reveal"}
          </button>
          <button type="button" onClick={copy} className="btn btn-primary">
            Copy
          </button>
        </>
      ) : (
        <div className="text-[9px] text-ink-mute max-w-[200px] leading-relaxed">
          Key is hashed — regenerate to see a new one.
        </div>
      )}
    </div>
  );
}
