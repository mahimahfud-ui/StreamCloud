// Short-lived admin session: HMAC-signed token. Secrets come from env only.
const enc = new TextEncoder();
export const SESSION_TTL_SECONDS = 30 * 60;

function b64u(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64u(s: string): ArrayBuffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer as ArrayBuffer;
}
function secret(): string {
  const s = Deno.env.get("ADMIN_SESSION_SECRET") ?? "";
  if (s.length < 32) throw new Error("ADMIN_SESSION_SECRET is missing or shorter than 32 characters.");
  return s;
}
async function hmacKey(usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, usage);
}

export async function issueToken(): Promise<{ token: string; expiresAt: number }> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = b64u(enc.encode(JSON.stringify({ exp, jti: crypto.randomUUID() })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(["sign"]), enc.encode(payload));
  return { token: payload + "." + b64u(sig), expiresAt: exp * 1000 };
}

export async function verifyToken(token: string | null): Promise<boolean> {
  try {
    if (!token || token.length > 600) return false;
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return false;
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(["verify"]), fromB64u(sig), enc.encode(payload));
    if (!ok) return false;
    const { exp } = JSON.parse(new TextDecoder().decode(fromB64u(payload)));
    return typeof exp === "number" && exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

export function requireAdmin(req: Request): Promise<boolean> {
  return verifyToken(req.headers.get("x-admin-token"));
}

/** Constant-time string comparison (hash both sides first so lengths do not leak). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([a, b].map(async (v) => new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(v)))));
  let diff = 0; for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

export async function sha256Hex(v: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(v)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
