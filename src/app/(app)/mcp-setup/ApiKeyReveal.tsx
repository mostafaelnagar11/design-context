"use client";

import { useEffect, useState } from "react";
import { clearFreshApiKey } from "@/app/(auth)/actions";

export default function ApiKeyReveal({ freshKey }: { freshKey: string | null }) {
  const [key, setKey] = useState<string | null>(freshKey);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

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
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-10 bg-surface-3 border border-border rounded-lg font-mono text-[12px] px-3.5 flex items-center text-accent tracking-wider overflow-hidden">
        {display}
      </div>
      {key ? (
        <>
          <button type="button" onClick={() => setRevealed((r) => !r)} className="btn btn-ghost btn-sm shrink-0">
            {revealed ? "Hide" : "Reveal"}
          </button>
          <button type="button" onClick={copy} className="btn btn-primary btn-sm shrink-0">
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </>
      ) : (
        <p className="text-[12px] text-secondary max-w-[200px] leading-relaxed">
          Key is hashed — regenerate to see a new one.
        </p>
      )}
    </div>
  );
}
