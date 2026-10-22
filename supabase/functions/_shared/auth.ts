// Opaque server-tracked admin sessions. The browser only receives an HttpOnly cookie.
import { serviceClient } from "./db.ts";

export const SESSION_TTL_SECONDS = 8 * 60 * 60;
const COOKIE_NAME = "sc_admin";

export async function sha256Hex(v: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function issueToken(): Promise<{ token: string; tokenHash: string; expiresAt: number }> {
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  return { token, tokenHash: await sha256Hex(token), expiresAt };
}

export function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS): string {
  return `${COOKIE_NAME}=${token}; Max-Age=${maxAge}; Path=/functions/v1; HttpOnly; Secure; SameSite=None`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/functions/v1; HttpOnly; Secure; SameSite=None`;
}

export function getSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === COOKIE_NAME) {
      const token = rawValue.join("=").trim();
      return /^[a-f0-9]{64}$/.test(token) ? token : null;
    }
  }
  return null;
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
