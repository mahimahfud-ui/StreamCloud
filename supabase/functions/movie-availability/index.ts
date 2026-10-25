import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const allowedOrigins = new Set([
  "https://mahimahfud-ui.github.io",
  "https://streamcloud.ai.studio",
  "https://streamcloud-527d.onrender.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const headersFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://mahimahfud-ui.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: { ...headersFor(origin), "Content-Type": "application/json", "Cache-Control": "no-store" } });

const hits = new Map<string, { count: number; expires: number }>();
function allowed(req: Request): boolean {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const old = hits.get(ip);
  if (!old || old.expires < now) { hits.set(ip, { count: 1, expires: now + 60_000 }); return true; }
  if (old.count >= 20) return false;
  old.count += 1;
  return true;
}
async function tmdb(path: string, key: string) {
  const url = new URL("https://api.themoviedb.org/3/" + path);
  url.searchParams.set("api_key", key);
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error("TMDB request failed with status " + response.status);
  return await response.json();
}
function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f]/g, "").slice(0, max) : "";
}
function titleOf(item: any, mediaType: "movie" | "tv") {
  return mediaType === "tv" ? String(item.name || "") : String(item.title || "");
}
function dateOf(item: any, mediaType: "movie" | "tv") {
  return mediaType === "tv" ? item.first_air_date : item.release_date;
}
serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headersFor(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origin not allowed." }, 403, origin);
  if (!allowed(req)) return json({ error: "Too many searches. Please wait a minute and try again." }, 429, origin);

  const key = Deno.env.get("TMDB_API_KEY")?.trim();
  if (!key) return json({ error: "Movie availability is not configured yet. Add TMDB_API_KEY to Supabase Edge Function secrets." }, 503, origin);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400, origin); }
  const query = clean(body.title, 120);
  const region = clean(body.region, 2).toUpperCase() || "BD";
  if (query.length < 2) return json({ error: "Enter at least two characters for the title." }, 422, origin);
  if (!/^[A-Z]{2}$/.test(region)) return json({ error: "Invalid region code." }, 422, origin);

  try {
    const encoded = encodeURIComponent(query);
    const [movieSearch, tvSearch] = await Promise.all([
      tmdb("search/movie?query=" + encoded + "&include_adult=false&language=en-US&page=1", key),
      tmdb("search/tv?query=" + encoded + "&include_adult=false&language=en-US&page=1", key),
    ]);
    const candidates = [
      ...(Array.isArray(movieSearch.results) ? movieSearch.results.map((item: any) => ({ item, mediaType: "movie" as const })) : []),
      ...(Array.isArray(tvSearch.results) ? tvSearch.results.map((item: any) => ({ item, mediaType: "tv" as const })) : []),
    ];
    if (!candidates.length) return json({ found: false, query, message: "No matching movie or series was found." }, 200, origin);
    const q = query.toLowerCase();
    candidates.sort((a, b) => {
      const ae = titleOf(a.item, a.mediaType).toLowerCase() === q ? 1 : 0;
      const be = titleOf(b.item, b.mediaType).toLowerCase() === q ? 1 : 0;
      return be - ae || Number(b.item.popularity || 0) - Number(a.item.popularity || 0);
    });
    const selected = candidates[0];
    const item = selected.item;
    const mediaType = selected.mediaType;
    const availability = await tmdb(mediaType + "/" + encodeURIComponent(String(item.id)) + "/watch/providers", key);
    const regionData = availability.results?.[region] || null;
    const categories = ["free", "ads", "flatrate", "rent", "buy"];
    const options = categories.flatMap((category) => (Array.isArray(regionData?.[category]) ? regionData[category] : []).map((p: any) => ({
      name: clean(p.provider_name, 100),
      logo: p.logo_path ? "https://image.tmdb.org/t/p/w92" + p.logo_path : null,
      type: category,
    })));
    return json({
      found: true,
      mediaType,
      movie: {
        id: item.id,
        title: clean(titleOf(item, mediaType), 160),
        year: typeof dateOf(item, mediaType) === "string" ? dateOf(item, mediaType).slice(0, 4) : "",
        overview: clean(item.overview, 500),
        poster: item.poster_path ? "https://image.tmdb.org/t/p/w500" + item.poster_path : null,
      },
      region,
      options,
      watchLink: typeof regionData?.link === "string" ? regionData.link : null,
      message: options.length ? "Availability information supplied by TMDB/JustWatch." : "No verified streaming provider data was returned for this region.",
    }, 200, origin);
  } catch (error) {
    console.error("[movie-availability]", error instanceof Error ? error.message : "request failed");
    return json({ error: "Could not check availability right now. Please try again later." }, 502, origin);
  }
});