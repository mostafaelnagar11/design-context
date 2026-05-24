"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { importFromFigmaAction, disconnectFigmaAction, ImportResult } from "../actions";

type Props = {
  systemId: string;
  isConnected: boolean;
  figmaEmail?: string | null;
};

type PanelStep = "closed" | "import" | "loading" | "done" | "error";

export function FigmaImportButton({ systemId, isConnected, figmaEmail }: Props) {
  const [connected, setConnected] = useState(isConnected);
  const [email, setEmail] = useState(figmaEmail ?? "");
  const [step, setStep] = useState<PanelStep>("closed");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [connectError, setConnectError] = useState("");
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const popupRef = useRef<Window | null>(null);

  // Listen for the OAuth popup to post back a message
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
      const res = await importFromFigmaAction(fd);
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
        className={`btn btn-sm ${connected ? "border-[#16A34A] text-[#16A34A]" : "btn-ghost"}`}
        onClick={() => step === "closed" ? setStep(connected ? "import" : "import") : close()}
      >
        {connected ? "✓ Figma" : "↑ Figma"}
      </button>

      {/* Backdrop + Panel */}
      {step !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="w-full max-w-md border-2 border-ink bg-shell shadow-[4px_4px_0_#1a1a1a]">

            {/* Header */}
            <div className="px-5 py-3 border-b-2 border-ink bg-panel flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold tracking-wider">IMPORT FROM FIGMA</div>
                <div className="text-[9px] text-ink-mute mt-0.5">
                  {connected
                    ? `Connected as ${email || "Figma user"}`
                    : "Connect your Figma account to import variables"}
                </div>
              </div>
              <button onClick={close} className="text-ink-mute hover:text-ink text-[14px]">✕</button>
            </div>

            <div className="p-5 flex flex-col gap-4">

              {/* ── Not connected ── */}
              {!connected && (
                <>
                  <div className="text-[10px] text-soft leading-relaxed">
                    Connect once — Design Context will import your Figma variables (colors, spacing, radii) without asking for credentials again.
                  </div>
                  {connectError && (
                    <div className="border-2 border-[#DC2626] bg-[#FEF2F2] p-3 text-[10px] text-[#DC2626]">
                      {connectError}
                    </div>
                  )}
                  <button
                    onClick={openConnectPopup}
                    className="btn btn-primary self-start"
                  >
                    Connect to Figma →
                  </button>
                </>
              )}

              {/* ── Import form ── */}
              {connected && (step === "import" || step === "loading") && (
                <form ref={formRef} onSubmit={handleImport} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] tracking-wider uppercase text-ink-mute">
                      Figma File URL
                    </label>
                    <input
                      name="figma_url"
                      required
                      placeholder="https://www.figma.com/design/XXXXXXX/…"
                      className="input text-[10px]"
                      disabled={step === "loading"}
                    />
                    <div className="text-[8px] text-ink-mute">
                      Paste any file URL — we extract the key automatically.
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-[#C8C4B8] p-3 text-[8px] text-ink-mute leading-relaxed">
                    ⚠ Replaces existing color, spacing and radii tokens with values from the Figma file. Typography and shadow tokens are unaffected.
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={step === "loading"}
                      className="btn btn-primary"
                    >
                      {step === "loading" ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin inline-block w-3 h-3 border border-shell border-t-transparent rounded-full" />
                          Importing…
                        </span>
                      ) : "Import Variables →"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="text-[9px] text-ink-mute hover:text-ink underline"
                    >
                      Disconnect Figma
                    </button>
                  </div>
                </form>
              )}

              {/* ── Success ── */}
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
                  <div className="flex gap-3">
                    <button onClick={close} className="btn btn-sm">Done</button>
                    <button onClick={() => { setResult(null); setStep("import"); }} className="btn btn-sm btn-ghost">
                      Import another
                    </button>
                  </div>
                </div>
              )}

              {/* ── Error ── */}
              {step === "error" && result && !result.ok && (
                <div className="flex flex-col gap-4">
                  <div className="border-2 border-[#DC2626] bg-[#FEF2F2] p-3 text-[10px] text-[#DC2626] leading-relaxed">
                    {result.error}
                  </div>
                  <button onClick={() => { setResult(null); setStep("import"); }} className="btn btn-sm self-start">
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
