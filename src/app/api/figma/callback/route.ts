import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied access
  if (error) {
    return closePopup({ error: "figma_denied" });
  }

  if (!code || !state) {
    return closePopup({ error: "missing_params" });
  }

  // Validate state cookie
  const savedState = cookies().get("figma_oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return closePopup({ error: "invalid_state" });
  }
  cookies().delete("figma_oauth_state");

  // Extract systemId from state (format: "systemId:nonce")
  const systemId = state.split(":")[0] ?? "";

  // Check user session
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return closePopup({ error: "not_logged_in" });

  // Exchange code for access token
  const tokenRes = await fetch("https://api.figma.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.FIGMA_CLIENT_ID!,
      client_secret: process.env.FIGMA_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/figma/callback`,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("[figma/callback] token exchange failed:", text);
    return closePopup({ error: "token_exchange_failed" });
  }

  const tokenData = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    user_id?: string;
    email?: string;
  };

  // Fetch Figma user email if not returned in token response
  let figmaEmail = tokenData.email ?? "";
  if (!figmaEmail) {
    try {
      const meRes = await fetch("https://api.figma.com/v1/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json() as { email?: string };
        figmaEmail = me.email ?? "";
      }
    } catch {}
  }

  // Store in figma_connections
  const admin = createAdminClient();
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  const { error: dbErr } = await admin.from("figma_connections").upsert(
    {
      user_id: user.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      expires_at: expiresAt,
      figma_email: figmaEmail,
    },
    { onConflict: "user_id" }
  );

  if (dbErr) {
    console.error("[figma/callback] db upsert failed:", dbErr);
    return closePopup({ error: "db_error" });
  }

  return closePopup({ success: "true", system_id: systemId, email: figmaEmail });
}

/** Renders a tiny HTML page that posts a message to the opener and closes itself */
function closePopup(params: Record<string, string>) {
  const data = JSON.stringify(params);
  const html = `<!DOCTYPE html><html><body><script>
    try { window.opener.postMessage(${data}, window.location.origin); } catch(e) {}
    window.close();
  </script></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
