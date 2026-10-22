// CORS + JSON helpers shared by all admin functions.
const DEFAULT_ORIGINS = [
  "https://mahimahfud-ui.github.io",
  "https://streamcloud.ai.studio",
  "https://www.streamcloud.ai.studio",
];

function originAllowed(origin: string, configured: Set<string>): boolean {
  if (!origin || origin === "null") return false;
  if (configured.has(origin)) return true;
  try {
    const u = new URL(origin);
    // GitHub Pages preview/fork domains need the same public static frontend to call this API.
    if (u.protocol === "https:" && (u.hostname === "github.io" || u.hostname.endsWith(".github.io"))) return true;
    // Local HTTP origins are allowed for development only; file:// (Origin: null) stays blocked.
    if (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname)) return true;
  } catch {
    return false;
  }
  return false;
}

export function corsHeaders(req: Request): Record<string, string> {
  const configured = new Set([
    ...DEFAULT_ORIGINS,
    ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ]);
  const origin = req.headers.get("origin") ?? "";
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "content-type, x-admin-token, apikey, authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
  if (originAllowed(origin, configured)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);
  return null;
}

export async function readJson(req: Request, maxBytes = 64_000): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
  } catch { return null; }
}
