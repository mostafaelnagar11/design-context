import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function Landing() {
  return (
    <main className="min-h-screen bg-bg flex flex-col">
      {/* Nav */}
      <nav className="h-14 border-b border-border flex items-center px-8 gap-4">
        <Logo />
        <div className="flex-1" />
        <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
        <Link href="/signup" className="btn btn-primary btn-sm">Get started free</Link>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-xl text-center flex flex-col items-center gap-6">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="text-[12px] text-accent font-medium">MCP-powered design tokens</span>
          </div>

          <Logo size={56} showName={false} />

          <h1 className="text-[48px] font-semibold text-primary leading-[1.1] tracking-tight">
            Your design system.<br />
            <span className="text-accent">Inside Claude.</span>
          </h1>

          <p className="text-[16px] text-secondary leading-relaxed max-w-md">
            Import your Figma tokens once. Claude fetches them automatically whenever you reference your design system in a prompt.
          </p>

          <div className="flex items-center gap-3">
            <Link href="/signup" className="btn btn-primary h-11 px-6 text-[14px]">
              Get started free →
            </Link>
            <Link href="/login" className="btn btn-ghost h-11 px-6 text-[14px]">
              Sign in
            </Link>
          </div>

          <p className="text-[12px] text-muted">No credit card required</p>
        </div>
      </div>
    </main>
  );
}
