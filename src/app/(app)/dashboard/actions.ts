"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/ensure-profile";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createSystemAction() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Heal missing profile row (e.g. if signup partially failed).
  const { created, apiKey } = await ensureProfile(user.id, user.email ?? "");
  if (created && apiKey) {
    cookies().set("dctx_new_api_key", apiKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    });
  }

  const baseName = "Untitled System";
  const { data: existing } = await supabase
    .from("design_systems")
    .select("name")
    .eq("user_id", user.id)
    .ilike("name", `${baseName}%`);

  const n = (existing?.length ?? 0) + 1;
  const name = n === 1 ? baseName : `${baseName} ${n}`;
  const slug = slugify(name);

  const { data, error } = await supabase
    .from("design_systems")
    .insert({ user_id: user.id, name, slug, status: "draft" })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create system");
  redirect(`/system/${data.id}`);
}

export async function publishSystemAction(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("design_systems").update({ status: "published" }).eq("id", id);
  redirect(`/system/${id}`);
}

export async function unpublishSystemAction(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("design_systems").update({ status: "draft" }).eq("id", id);
  redirect(`/system/${id}`);
}
