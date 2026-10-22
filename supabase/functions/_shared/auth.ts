// Opaque, revocable admin sessions. Only token hashes are stored in Supabase.
import { serviceClient } from "./db.ts";

export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export async function sha256Hex(v: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function issueToken(): Promise<{ token: string; tokenHash: string; expiresAt: number }> {
  const token = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  return { token, tokenHash: await sha256Hex(token), expiresAt };
}

export function getSessionToken(req: Request): string | null {
  const token = (req.headers.get("x-admin-token") ?? "").trim();
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export async function requireAdmin(req: Request): Promise<boolean> {
  const token = getSessionToken(req);
  if (!token) return false;
  try {
    const db = serviceClient();
    const hash = await sha256Hex(token);
    const { data, error } = await db.from("admin_sessions")
      .select("token_hash")
      .eq("token_hash", hash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data) return false;
    await db.from("admin_sessions").update({ last_seen_at: new Date().toISOString() }).eq("token_hash", hash);
    return true;
  } catch {
    return false;
  }
}
