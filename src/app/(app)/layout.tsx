import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "../(auth)/actions";
import { Logo } from "@/components/Logo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top nav */}
      <nav className="h-14 border-b border-border flex items-center px-6 gap-4 bg-surface shrink-0">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <div className="flex-1" />
        <Link href="/mcp-setup" className="btn btn-ghost btn-sm">MCP Setup</Link>
        <form action={logoutAction}>
          <button className="btn btn-ghost btn-sm">Sign out</button>
        </form>
        <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 grid place-items-center text-[12px] font-semibold text-accent">
          {user?.email?.[0]?.toUpperCase() ?? "?"}
        </div>
      </nav>
      <div className="flex-1 flex">{children}</div>
    </div>
  );
}
