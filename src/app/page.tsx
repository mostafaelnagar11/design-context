import Link from "next/link";

export default function Landing() {
  return (
    <main className="min-h-screen flex items-center justify-center p-10">
      <div className="shell w-full max-w-3xl">
        <nav className="h-12 border-b-2 border-ink flex items-center px-5 gap-3 bg-panel">
          <span className="text-[10px] font-bold tracking-[2px] bg-ink text-shell px-2.5 py-1">
            DESIGNCTX
          </span>
          <div className="flex-1" />
          <Link href="/login" className="btn">Log in</Link>
          <Link href="/signup" className="btn btn-primary">Get Started</Link>
        </nav>
        <div className="p-10 flex flex-col gap-5">
          <div className="text-[8px] tracking-[3px] uppercase text-ink-mute">
            Design × Claude
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            Your design system.<br />Inside Claude.
          </h1>
          <p className="text-[11px] text-soft leading-relaxed max-w-md">
            Import your Figma tokens once. Claude fetches them automatically
            whenever you mention your system name in a prompt.
          </p>
          <div className="flex gap-3 mt-2">
            <Link href="/signup" className="btn btn-primary h-10 text-[11px]">
              Get Started Free →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
