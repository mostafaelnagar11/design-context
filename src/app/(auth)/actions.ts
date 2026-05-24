"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey, hashApiKey } from "@/lib/api-key";

const API_KEY_COOKIE = "dctx_new_api_key";

export async function signupAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/signup?error=" + encodeURIComponent("Email and password required"));
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect("/signup?error=" + encodeURIComponent(error.message));
  }
  if (!data.user) {
    redirect(
      "/signup?error=" +
        encodeURIComponent("No user returned — email may already be registered or email confirmation is required")
    );
  }
  // Supabase returns identities:[] when the email already exists (with confirmation enabled).
  if (data.user.identities && data.user.identities.length === 0) {
    redirect(
      "/signup?error=" +
        encodeURIComponent("Email already registered — try logging in")
    );
  }

  const apiKey = generateApiKey();
  const hashed = hashApiKey(apiKey);

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("users").insert({
    id: data.user.id,
    email,
    hashed_api_key: hashed,
  });

  if (insertError) {
    redirect("/signup?error=" + encodeURIComponent(insertError.message));
  }

  // Stash plaintext key in an httpOnly cookie so the MCP Setup page
  // can show it exactly once. Cleared on read.
  cookies().set(API_KEY_COOKIE, apiKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  redirect("/mcp-setup?fresh=1");
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?error=" + encodeURIComponent(error.message));
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function regenerateApiKeyAction(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const apiKey = generateApiKey();
  const hashed = hashApiKey(apiKey);

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .upsert(
      { id: user.id, email: user.email ?? "", hashed_api_key: hashed },
      { onConflict: "id" }
    );
  if (error) throw new Error(error.message);

  cookies().set(API_KEY_COOKIE, apiKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  redirect("/mcp-setup?fresh=1");
}

export async function readFreshApiKey(): Promise<string | null> {
  return cookies().get(API_KEY_COOKIE)?.value ?? null;
}

export async function clearFreshApiKey(): Promise<void> {
  cookies().delete(API_KEY_COOKIE);
}
