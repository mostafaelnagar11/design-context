"use client";

import { useRef, useState, useTransition } from "react";
import { importFromFigmaAction, ImportResult } from "../actions";

type Step = "idle" | "open" | "loading" | "done" | "error";

export function FigmaImportButton({ systemId }: { systemId: string }) {
  const [step, setStep] = useState<Step>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(formRef.current!);
    fd.set("system_id", systemId);
    setStep("loading");
    startTransition(async () => {
      const res = await importFromFigmaAction(fd);
      setResult(res);
      setStep(res.ok ? "done" : "error");
    });
  };

  const reset = () => { setStep("idle"); setResult(null); formRef.current?.reset(); };

  return (
    <>
      {/* Trigger button */}
      <button
        className="btn btn-sm btn-ghost"
        onClick={() => step === "idle" ? setStep("open") : reset()}
      >
        ↑ Figma
      </button>

      {/* Panel — renders below the header via a portal-like absolute div */}
      {step !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) reset(); }}>
          <div className="w-full max-w-md border-2 border-ink bg-shell shadow-[4px_4px_0_#1a1a1a]">
            {/* Header */}
            <div className="px-5 py-3 border-b-2 border-ink bg-panel flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold tracking-wider">IMPORT FROM FIGMA</div>
                <div className="text-[9px] text-ink-mute mt-0.5">
                  Imports local variables — colors, spacing & radii
                </div>
              </div>
              <button onClick={reset} className="text-ink-mute hover:text-ink text-[14px] leading-none">✕</button>
            </div>

            {/* Body */}
            <div className="p-5">
              {/* Success */}
              {step === "done" && result?.ok && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-[#16A34A] text-[#16A34A] grid place-items-center text-[10px]">✓</div>
                    <span className="text-[11px] font-bold">Import complete</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Colors", n: result.counts.colors },
                      { label: "Spacing", n: result.counts.spacing },
                      { label: "Radii", n: result.counts.radii },
                    ].map(({ label, n }) => (
                      <div key={label} className="border-2 border-ink p-3 text-center bg-panel">
                        <div className="text-[18px] font-bold">{n}</div>
                        <div className="text-[8px] text-ink-mute tracking-wider uppercase mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                  {result.counts.skipped > 0 && (
                    <div className="text-[9px] text-ink-mute">
                      {result.counts.skipped} variables skipped (aliases, booleans, strings).
                    </div>
                  )}
                  <button onClick={reset} className="btn btn-sm self-start">Done</button>
                </div>
              )}

              {/* Error */}
              {step === "error" && result && !result.ok && (
                <div className="flex flex-col gap-4">
                  <div className="border-2 border-[#DC2626] bg-[#FEF2F2] p-3 text-[10px] text-[#DC2626] leading-relaxed">
                    {result.error}
                  </div>
                  <button onClick={() => setStep("open")} className="btn btn-sm self-start">← Try again</button>
                </div>
              )}

              {/* Form */}
              {(step === "open" || step === "loading") && (
                <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] tracking-wider uppercase text-ink-mute">Figma File URL</label>
                    <input
                      name="figma_url"
                      required
                      placeholder="https://www.figma.com/design/XXXXXXX/…"
                      className="input text-[10px]"
                      disabled={step === "loading"}
                    />
                    <div className="text-[8px] text-ink-mute">Paste the file URL or just the file key.</div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] tracking-wider uppercase text-ink-mute">Personal Access Token</label>
                    <input
                      name="figma_token"
                      type="password"
                      required
                      placeholder="figd_…"
                      className="input text-[10px] font-mono"
                      disabled={step === "loading"}
                    />
                    <div className="text-[8px] text-ink-mute leading-relaxed">
                      Figma → Account Settings → Security → Personal access tokens.
                      <br />Token is used once and never stored.
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-[#C8C4B8] p-3 text-[8px] text-ink-mute leading-relaxed">
                    ⚠ This replaces existing color, spacing and radii tokens with values from the Figma file. Typography and shadow tokens are unaffected.
                  </div>

                  <button
                    type="submit"
                    disabled={step === "loading"}
                    className="btn btn-primary self-start"
                  >
                    {step === "loading" ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin inline-block w-3 h-3 border border-shell border-t-transparent rounded-full" />
                        Importing…
                      </span>
                    ) : (
                      "Import Variables →"
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
