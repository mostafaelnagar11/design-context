"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  importFromFigmaAction,
  importFromFigmaStylesAction,
  disconnectFigmaAction,
  ImportResult,
} from "../actions";

type Props = {
  systemId: string;
  isConnected: boolean;
  figmaEmail?: string | null;
};

type PanelStep = "closed" | "import" | "loading" | "done" | "error";
type ImportMode = "styles" | "variables";

const MODE_INFO: Record<ImportMode, {
  label: string;
  plan: string;
  planClass: string;
  description: string;
  imports: string;
}> = {
  styles: {
    label: "Styles",
    plan: "Personal · Pro · Organization",
    planClass: "tag-green",
    description: "Imports published paint styles (colors), text styles (typography), and effect styles (shadows).",
    imports: "Colors · Typography · Shadows",
  },
  variables: {
    label: "Variables",
    plan: "Enterprise only",
    planClass: "tag-amber",
    description: "Imports local variables — primitive colors, spacing, and radii values from variable collections.",
    imports: "Colors · Spacing · Radii",
  },
};

export function FigmaImportButton({ systemId, isConnected, figmaEmail }: Props) {
  const [connected, setConnected] = useState(isConnected);
  const [email, setEmail] = useState(figmaEmail ?? "");
  const [step, setStep] = useState<PanelStep>("closed");
  const [mode, setMode] = useState<ImportMode>("styles");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [connectError, setConnectError] = useState("");
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const popupRef = useRef<Window | null>(null);

  const handleMessage = useCallback((e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    const data = e.data as Record<string, string>;
    if (data.success === "true") {
      setConnected(true);
      setEmail(data.email ?? "");
      setConnectError("");
      setStep("import");
    } else if (data.error) {
      const msg: Record<string, string> = {
        figma_denied: "You denied access — click Connect to try again.",
        token_exchange_failed: "Figma token exchange failed. Check your OAuth app settings.",
        invalid_state: "Security check failed. Try again.",
        db_error: "Could not save connection. Try again.",
        not_logged_in: "Session expired. Reload the page.",
      };
      setConnectError(msg[data.error] ?? "Connection failed. Try again.");
    }
    popupRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  const openConnectPopup = () => {
    setConnectError("");
    const url = `/api/figma/connect?system_id=${systemId}`;
    const popup = window.open(url, "figma_oauth", "width=600,height=700,left=200,top=100");
    popupRef.current = popup;
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(formRef.current!);
    fd.set("system_id", systemId);
    setStep("loading");
    startTransition(async () => {
      const action = mode === "styles" ? importFromFigmaStylesAction : importFromFigmaAction;
      const res = await action(fd);
      setResult(res);
      setStep(res.ok ? "done" : "error");
    });
  };

  const handleDisconnect = () => {
    startTransition(async () => {
      await disconnectFigmaAction();
      setConnected(false);
      setEmail("");
      setStep("closed");
    });
  };

  const close = () => { setStep("closed"); setResult(null); setConnectError(""); };

  return (
    <>
      {/* Trigger */}
      <button
        className={`btn btn-ghost btn-sm ${connected ? "border-green/40 text-green hover:border-green/60" : ""}`}
        onClick={() => step === "closed" ? setStep("import") : close()}
      >
        {connected ? "✓ Figma" : "↑ Figma"}
      </button>

      {/* Modal */}
      {step !== "closed" && (
        <div
          className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-start justify-center pt-16 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="w-full max-w-md card overflow-hidden shadow-modal">

            {/* Header */}
            <div className="px-5 py-4 border-b border-border bg-surface-2 flex items-center justify-between">
              <div>
                <div className="text-[14px] font-semibold text-primary">Import from Figma</div>
                <div className="text-[12px] text-secondary mt-0.5">
                  {connected ? `Connected as ${email || "Figma user"}` : "Connect your Figma account first"}
                </div>
              </div>
              <button
                onClick={close}
                className="text-muted hover:text-secondary transition-colors text-[18px] leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-surface-3"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">

              {/* ── Not connected ── */}
              {!connected && (
                <>
                  <p className="text-[13px] text-secondary leading-relaxed">
                    Connect once — Design Context will import your Figma tokens without asking for credentials again.
                  </p>
                  {connectError && (
                    <div className="bg-red/10 border border-red/20 rounded-lg px-3 py-2.5 text-[13px] text-red">
                      {connectError}
                    </div>
                  )}
                  <button onClick={openConnectPopup} className="btn btn-primary self-start">
                    Connect to Figma →
                  </button>
                </>
              )}

              {/* ── Import form ── */}
              {connected && (step === "import" || step === "loading") && (
                <>
                  {/* Mode tabs */}
                  <div className="flex rounded-lg bg-surface-3 border border-border p-0.5 gap-0.5">
                    {(["styles", "variables"] as ImportMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`flex-1 h-8 rounded-md text-[12px] font-medium transition-all ${
                          mode === m
                            ? "bg-surface text-primary border border-border shadow-sm"
                            : "text-secondary hover:text-primary"
                        }`}
                      >
                        {MODE_INFO[m].label}
                      </button>
                    ))}
                  </div>

                  {/* Mode info card */}
                  <div className="bg-surface-2 border border-border rounded-lg px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-primary">
                        Imports: {MODE_INFO[mode].imports}
                      </span>
                      <span className={`tag ${MODE_INFO[mode].planClass}`}>
                        {MODE_INFO[mode].plan}
                      </span>
                    </div>
                    <p className="text-[12px] text-secondary leading-relaxed">
                      {MODE_INFO[mode].description}
                    </p>
                    {mode === "variables" && (
                      <p className="text-[11px] text-amber/80 leading-relaxed">
                        ⚠ Variables require a Figma Enterprise plan. If you&apos;re on Personal or Pro, use Styles instead.
                      </p>
                    )}
                  </div>

                  <form ref={formRef} onSubmit={handleImport} className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-medium text-secondary">Figma File URL</span>
                      <input
                        name="figma_url"
                        required
                        placeholder="https://www.figma.com/design/XXXXXXX/…"
                        className="input"
                        disabled={step === "loading"}
                      />
                      <span className="text-[11px] text-muted">Paste any file URL — we extract the key automatically.</span>
                    </label>

                    <div className="bg-amber/5 border border-amber/20 rounded-lg px-3 py-2.5 text-[12px] text-amber/80 leading-relaxed">
                      ⚠ Replaces existing {MODE_INFO[mode].imports.toLowerCase()} tokens with values from this file.
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={step === "loading"}
                        className="btn btn-primary disabled:opacity-60"
                      >
                        {step === "loading" ? (
                          <span className="flex items-center gap-2">
                            <span className="animate-spin inline-block w-3.5 h-3.5 border border-white/30 border-t-white rounded-full" />
                            Importing…
                          </span>
                        ) : `Import ${MODE_INFO[mode].label} →`}
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        className="text-[12px] text-muted hover:text-secondary underline transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* ── Success ── */}
              {step === "done" && result?.ok && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-green/20 border border-green/30 flex items-center justify-center text-green text-[12px]">✓</div>
                    <span className="text-[14px] font-semibold text-primary">Import complete</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {result.mode === "variables" ? (
                      <>
                        {[
                          { label: "Colors",  n: result.counts.colors },
                          { label: "Spacing", n: result.counts.spacing },
                          { label: "Radii",   n: result.counts.radii },
                        ].map(({ label, n }) => (
                          <div key={label} className="bg-surface-2 border border-border rounded-lg p-3 text-center">
                            <div className="text-[22px] font-semibold text-primary">{n}</div>
                            <div className="text-[11px] text-secondary mt-0.5">{label}</div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        {[
                          { label: "Colors",     n: result.counts.colors },
                          { label: "Typography", n: result.counts.typography },
                          { label: "Shadows",    n: result.counts.shadows },
                        ].map(({ label, n }) => (
                          <div key={label} className="bg-surface-2 border border-border rounded-lg p-3 text-center">
                            <div className="text-[22px] font-semibold text-primary">{n}</div>
                            <div className="text-[11px] text-secondary mt-0.5">{label}</div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {result.counts.skipped > 0 && (
                    <p className="text-[12px] text-secondary">
                      {result.counts.skipped} {result.mode === "variables" ? "variables" : "styles"} skipped.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={close} className="btn btn-primary btn-sm">Done</button>
                    <button onClick={() => { setResult(null); setStep("import"); }} className="btn btn-ghost btn-sm">
                      Import another
                    </button>
                  </div>
                </div>
              )}

              {/* ── Error ── */}
              {step === "error" && result && !result.ok && (
                <div className="flex flex-col gap-4">
                  <div className="bg-red/10 border border-red/20 rounded-lg px-3 py-3 text-[13px] text-red leading-relaxed">
                    {result.error}
                  </div>
                  <button
                    onClick={() => { setResult(null); setStep("import"); }}
                    className="btn btn-ghost btn-sm self-start"
                  >
                    ← Try again
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
