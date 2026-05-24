import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen p-6">
      <div className="shell flex flex-col min-h-[calc(100vh-48px)]">
        <nav className="h-12 border-b-2 border-ink flex items-center px-5 gap-3 bg-panel">
          <Link href="/dashboard" className="text-[10px] font-bold tracking-[2px] bg-ink text-shell px-2.5 py-1">
            DESIGNCTX
          </Link>
          <div className="flex-1" />
          <Link href="/mcp-setup" className="btn btn-sm">MCP Setup</Link>
          <form action={logoutAction}>
            <button className="btn btn-sm">Log out</button>
          </form>
          <div className="w-7 h-7 border-[1.5px] border-ink rounded-full bg-[#D0CEC6] grid place-items-center text-[9px]">
            {user?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
        </nav>
        <div className="flex-1 flex">{children}</div>
      </div>
    </div>
  );
}
