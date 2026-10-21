// URL safety (SSRF guard), safe outbound fetch and URL normalisation.
export const UA = "StreamCloudBot/1.0 (+https://mahimahfud-ui.github.io/StreamCloud/)";

export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase();
  const m4 = v.match(/^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m4) {
    const [a, b] = [Number(m4[1]), Number(m4[2])];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  if (v.includes(":")) {
    return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("64:ff9b") || v.startsWith("::ffff:");
  }
  return false;
}

/** Parse a user-supplied URL; only public https:// hosts with a real domain name are accepted. */
export function parsePublicUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  if (u.port && u.port !== "443") return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) && !/^[a-z0-9.-]+\.xn--[a-z0-9-]+$/.test(h)) return null;
  return u;
}

async function hostResolvesPublicly(host: string): Promise<boolean> {
  let supported = false, found = false;
  for (const type of ["A", "AAAA"] as const) {
    try {
      const recs = await Deno.resolveDns(host, type);
      supported = true;
      for (const r of recs) { found = true; if (isPrivateIp(String(r))) return false; }
    } catch (e) {
      const name = (e as Error)?.name ?? "";
      if (name === "NotFound") { supported = true; continue; }
      // resolver unavailable in this runtime: fall back to the hostname rules above
    }
  }
  return supported ? found : true;
}

/** fetch() with timeout, manual redirects (each hop re-validated) and a body-size cap. */
export async function safeFetch(
  start: URL,
  init: { headers?: Record<string, string>; timeoutMs?: number; method?: string } = {},
): Promise<{ res: Response; url: URL }> {
  let url = start;
  for (let hop = 0; hop < 5; hop++) {
    if (!parsePublicUrl(url.href)) throw new Error("Blocked URL");
    if (!(await hostResolvesPublicly(url.hostname))) throw new Error("Host does not resolve to a public address");
    const res = await fetch(url.href, {
      method: init.method ?? "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(init.timeoutMs ?? 8000),
      headers: { "User-Agent": UA, "Accept": "*/*", ...(init.headers ?? {}) },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      await res.body?.cancel();
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    return { res, url };
  }
  throw new Error("Too many redirects");
}

export async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value); total += value.length;
  }
  await reader.cancel().catch(() => {});
  const out = new Uint8Array(Math.min(total, maxBytes)); let o = 0;
  for (const c of chunks) { const n = Math.min(c.length, out.length - o); out.set(c.subarray(0, n), o); o += n; if (o >= out.length) break; }
  return out;
}

/** Stable key used to reject duplicate URLs. */
export function normalizeUrlKey(raw: string): string {
  const u = new URL(raw);
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !/^(utm_|fbclid$|gclid$|ref$|mc_)/i.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const q = params.length ? "?" + params.map(([k, v]) => `${k}=${v}`).join("&") : "";
  return host + u.pathname.replace(/\/+$/, "") + q;
}

export function baseDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  const sld = new Set(["co", "com", "org", "net", "gov", "ac"]);
  return parts.length > 2 && sld.has(parts[parts.length - 2]) && parts[parts.length - 1].length === 2
    ? parts.slice(-3).join(".") : parts.slice(-2).join(".");
}
