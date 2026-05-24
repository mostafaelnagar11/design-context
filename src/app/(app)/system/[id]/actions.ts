"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function assertOwner(systemId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data } = await supabase
    .from("design_systems")
    .select("id")
    .eq("id", systemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) throw new Error("Not found");
}

export async function addTokenAction(formData: FormData) {
  const systemId = String(formData.get("system_id"));
  await assertOwner(systemId);

  const category = String(formData.get("category"));
  const tokenName = String(formData.get("token_name")).trim();
  const tokenValueRaw = String(formData.get("token_value"));
  if (!tokenName) return;

  let tokenValue: unknown = tokenValueRaw;
  try {
    tokenValue = JSON.parse(tokenValueRaw);
  } catch {}

  const admin = createAdminClient();
  await admin.from("tokens").insert({
    system_id: systemId,
    category,
    token_name: tokenName,
    token_value: tokenValue,
    group_name: "default",
  });

  revalidatePath(`/system/${systemId}`);
}

export async function updateTokenAction(formData: FormData) {
  const systemId = String(formData.get("system_id"));
  await assertOwner(systemId);

  const id = String(formData.get("id"));
  const tokenName = String(formData.get("token_name")).trim();
  const tokenValueRaw = String(formData.get("token_value"));
  if (!tokenName) return;

  let tokenValue: unknown = tokenValueRaw;
  try {
    tokenValue = JSON.parse(tokenValueRaw);
  } catch {}

  const admin = createAdminClient();
  await admin
    .from("tokens")
    .update({ token_name: tokenName, token_value: tokenValue })
    .eq("id", id);

  revalidatePath(`/system/${systemId}`);
}

export async function deleteTokenAction(formData: FormData) {
  const systemId = String(formData.get("system_id"));
  await assertOwner(systemId);

  const id = String(formData.get("id"));

  const admin = createAdminClient();
  await admin.from("tokens").delete().eq("id", id);

  revalidatePath(`/system/${systemId}`);
}
