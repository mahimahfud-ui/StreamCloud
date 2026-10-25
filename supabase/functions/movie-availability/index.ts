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
function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f]/g, "").slice(0, max) : "";
}
function normalizeTitle(value: unknown): string {
  return clean(value, 200).toLocaleLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim().replace(/\s+/g, " ");
}
function titleMatchScore(candidate: unknown, query: string): number {
  const title = normalizeTitle(candidate);
  const q = normalizeTitle(query);
  if (!title || !q) return 0;
  if (title === q) return 100;
  if (title.startsWith(q + " ") || q.startsWith(title + " ")) return 75;
  const qt = q.split(" ").filter(Boolean);
  const tt = new Set(title.split(" ").filter(Boolean));
  const overlap = qt.filter(token => tt.has(token)).length / Math.max(qt.length, 1);
  return Math.round(overlap * 50);
}
function titleOf(item: any, mediaType: "movie" | "tv") {
  return mediaType === "tv" ? String(item.name || "") : String(item.title || "");
}
function dateOf(item: any, mediaType: "movie" | "tv") {
  return mediaType === "tv" ? item.first_air_date : item.release_date;
}
async function tmdb(path: string, key: string) {
  const url = new URL("https://api.themoviedb.org/3/" + path);
  url.searchParams.set("api_key", key);
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error("TMDB request failed with status " + response.status);
  return await response.json();
}
async function getJson(url: string) {
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Fallback catalog request failed with status " + response.status);
  return await response.json();
}
function providerSearchOptions(query: string) {
  const q = encodeURIComponent(query);
  const providers = [
    { name: "Netflix", domain: "netflix.com", url: "https://www.netflix.com/search?q=" + q },
    { name: "Prime Video", domain: "primevideo.com", url: "https://www.primevideo.com/search/ref=atv_nb_sr?phrase=" + q },
    { name: "YouTube Movies", domain: "youtube.com", url: "https://www.youtube.com/results?search_query=" + q + "+official+movie" },
    { name: "Apple TV", domain: "tv.apple.com", url: "https://tv.apple.com/search?term=" + q },
    { name: "Google Play", domain: "play.google.com", url: "https://play.google.com/store/search?q=" + q + "&c=movies" },
  ];
  return providers.map(p => ({
    name: p.name,
    logo: "https://www.google.com/s2/favicons?domain=" + p.domain + "&sz=128",
    type: "search",
    url: p.url,
    verified: false,
  }));
}
async function fallbackLookup(query: string, region: string) {
  const encoded = encodeURIComponent(query);
  let selected: any = null;
  let mediaType: "movie" | "tv" = "tv";
  let poster: string | null = null;
  let year = "";
  let overview = "";
  // TVmaze is a no-key catalog for TV series and provides poster art.
  try {
    const tv = await getJson("https://api.tvmaze.com/search/shows?q=" + encoded);
    if (Array.isArray(tv) && tv.length) {
      const ranked = tv.map((entry: any) => ({ entry, score: titleMatchScore(entry.show?.name, query) }))
        .sort((a: any, b: any) => b.score - a.score);
      const best = ranked[0];
      const entry = best && best.score >= 50 ? best.entry : null;
      if (entry?.show) {
        selected = entry.show;
        mediaType = "tv";
        poster = selected.image?.original || selected.image?.medium || null;
        year = String(selected.premiered || "").slice(0, 4);
        overview = clean(String(selected.summary || "").replace(/<[^>]*>/g, " "), 500);
      }
    }
  } catch (e) { console.warn("[movie-availability] TVmaze fallback:", e instanceof Error ? e.message : "failed"); }
  // Apple's public Search API is used as a no-key movie metadata/poster fallback.
  if (!selected) {
    try {
      const apple = await getJson("https://itunes.apple.com/search?term=" + encoded + "&media=movie&entity=movie&limit=10&country=" + (region.toLowerCase() === "bd" ? "us" : region.toLowerCase()));
      const results = Array.isArray(apple.results) ? apple.results : [];
      const ranked = results.map((item: any) => ({ item, score: titleMatchScore(item.trackName, query) }))
        .sort((a: any, b: any) => b.score - a.score);
      const best = ranked[0];
      const item = best && best.score >= 50 ? best.item : null;
      if (item) {
        selected = item;
        mediaType = "movie";
        poster = typeof item.artworkUrl100 === "string" ? item.artworkUrl100.replace("100x100bb", "600x900bb") : null;
        year = String(item.releaseDate || "").slice(0, 4);
        overview = clean(item.longDescription || item.shortDescription || "", 500);
      }
    } catch (e) { console.warn("[movie-availability] Apple fallback:", e instanceof Error ? e.message : "failed"); }
  }
  const options = providerSearchOptions(query);
  const title = selected ? clean(mediaType === "tv" ? selected.name : selected.trackName, 160) : query;
  const justWatchRegion = region.toLowerCase() === "gb" ? "uk" : region.toLowerCase();
  const watchLink = "https://www.justwatch.com/" + justWatchRegion + "/search?q=" + encoded;
  return {
    found: true,
    mediaType,
    movie: { id: selected?.id ?? selected?.trackId ?? null, title, year, overview, poster },
    region,
    options,
    watchLink,
    message: selected
      ? "Metadata and thumbnail supplied by a public catalog. Provider links open official service searches; availability is not independently verified."
      : "No catalog match was found. Provider links open official service searches; availability is not independently verified.",
    source: selected ? (mediaType === "tv" ? "TVmaze" : "Apple Search API") : "official-provider-search",
    verifiedAvailability: false,
  };
}
serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headersFor(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origin not allowed." }, 403, origin);
  if (!allowed(req)) return json({ error: "Too many searches. Please wait a minute and try again." }, 429, origin);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400, origin); }
  const query = clean(body.title, 120);
  const region = clean(body.region, 2).toUpperCase() || "BD";
  if (query.length < 2) return json({ error: "Enter at least two characters for the title." }, 422, origin);
  if (!/^[A-Z]{2}$/.test(region)) return json({ error: "Invalid region code." }, 422, origin);

  const key = Deno.env.get("TMDB_API_KEY")?.trim();
  // Do not fail just because TMDB isn't configured: use public no-key catalogs and official provider search links.
  if (!key) {
    try { return json(await fallbackLookup(query, region), 200, origin); }
    catch (error) {
      console.error("[movie-availability] fallback failed:", error instanceof Error ? error.message : "request failed");
      return json({ found: true, mediaType: "unknown", movie: { id: null, title: query, year: "", overview: "", poster: null }, region,
        options: providerSearchOptions(query), watchLink: "https://www.justwatch.com/" + region.toLowerCase() + "/search?q=" + encodeURIComponent(query),
        message: "Could not load a poster right now. Official provider search links are available; availability is not independently verified.",
        source: "official-provider-search", verifiedAvailability: false }, 200, origin);
    }
  }
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
    candidates.sort((a, b) => {
      const scoreA = titleMatchScore(titleOf(a.item, a.mediaType), query);
      const scoreB = titleMatchScore(titleOf(b.item, b.mediaType), query);
      return scoreB - scoreA || Number(b.item.popularity || 0) - Number(a.item.popularity || 0);
    });
    const selected = candidates[0];
    if (titleMatchScore(titleOf(selected.item, selected.mediaType), query) < 50) {
      return json({ found: false, query, message: "No sufficiently close title match was found. Try the full official title or include the release year." }, 200, origin);
    }
    const item = selected.item;
    const mediaType = selected.mediaType;
    const availability = await tmdb(mediaType + "/" + encodeURIComponent(String(item.id)) + "/watch/providers", key);
    const regionData = availability.results?.[region] || null;
    const categories = ["free", "ads", "flatrate", "rent", "buy"];
    const options = categories.flatMap((category) => (Array.isArray(regionData?.[category]) ? regionData[category] : []).map((p: any) => ({
      name: clean(p.provider_name, 100),
      logo: p.logo_path ? "https://image.tmdb.org/t/p/w92" + p.logo_path : null,
      type: category,
      url: typeof regionData?.link === "string" ? regionData.link : "https://www.justwatch.com/" + region.toLowerCase() + "/search?q=" + encoded,
      verified: true,
    })));
    return json({
      found: true, mediaType,
      movie: { id: item.id, title: clean(titleOf(item, mediaType), 160), year: typeof dateOf(item, mediaType) === "string" ? dateOf(item, mediaType).slice(0, 4) : "", overview: clean(item.overview, 500), poster: item.poster_path ? "https://image.tmdb.org/t/p/w500" + item.poster_path : null },
      region, options,
      watchLink: typeof regionData?.link === "string" ? regionData.link : "https://www.justwatch.com/" + region.toLowerCase() + "/search?q=" + encoded,
      message: options.length ? "Availability information supplied by TMDB/JustWatch." : "No verified streaming provider data was returned for this region.",
      source: "TMDB/JustWatch", verifiedAvailability: options.length > 0,
    }, 200, origin);
  } catch (error) {
    console.error("[movie-availability]", error instanceof Error ? error.message : "request failed");
    // If TMDB is configured but temporarily unavailable, still return usable official provider searches.
    return json({ ...(await fallbackLookup(query, region)), message: "TMDB could not confirm current availability. Official provider searches are available instead.", verifiedAvailability: false }, 200, origin);
  }
});
