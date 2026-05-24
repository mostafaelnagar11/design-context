import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const systemId = req.nextUrl.searchParams.get("system_id") ?? "";
  const state = `${systemId}:${randomBytes(16).toString("hex")}`;

  // Store state in a short-lived cookie to verify on callback
  cookies().set("figma_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 min
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: process.env.FIGMA_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/figma/callback`,
    scope: "current_user:read,file_content:read,file_variables:read",
    state,
    response_type: "code",
  });

  return NextResponse.redirect(`https://www.figma.com/oauth?${params}`);
}
