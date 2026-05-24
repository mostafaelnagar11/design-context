import { createAdminClient } from "./supabase/admin";
import { generateApiKey, hashApiKey } from "./api-key";

/**
 * Ensures a row exists in public.users for this auth user.
 * Returns the plaintext API key only if a NEW row was created.
 */
export async function ensureProfile(
  userId: string,
  email: string
): Promise<{ created: boolean; apiKey: string | null }> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existing) return { created: false, apiKey: null };

  const apiKey = generateApiKey();
  const hashed = hashApiKey(apiKey);
  const { error } = await admin
    .from("users")
    .insert({ id: userId, email, hashed_api_key: hashed });
  if (error) throw new Error(`Profile creation failed: ${error.message}`);

  return { created: true, apiKey };
}
