import { createHash, randomBytes } from "crypto";

const PREFIX = "dk_live_";
const KEY_LENGTH = 32;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateApiKey(): string {
  const bytes = randomBytes(KEY_LENGTH);
  let out = "";
  for (let i = 0; i < KEY_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return PREFIX + out;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
