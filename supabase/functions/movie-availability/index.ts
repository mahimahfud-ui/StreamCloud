import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { isAmbiguousMovieMatch, parseMovieQuery, rankMovieCandidates, scoreMovieCandidate, type SearchMediaType } from "./search-utils.ts";

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
let hitChecks = 0;
function allowed(req: Request): boolean {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  if ((++hitChecks % 64) === 0) {
    for (const [key, entry] of hits) if (entry.expires <= now) hits.delete(key);
  }
  const old = hits.get(ip);
  if (!old || old.expires < now) {
    if (hits.size >= 5000) {
      const first = hits.keys().next().value;
      if (first !== undefined) hits.delete(first);
    }
    hits.set(ip, { count: 1, expires: now + 60_000 });
    return true;
  }
  if (old.count >= 20) return false;
  old.count += 1;
  return true;
}
function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f]/g, "").slice(0, max) : "";
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
async function fallbackLookup(
  query: string,
  region: string,
  year: number | null = null,
  mediaType: SearchMediaType | null = null,
) {
  const encoded = encodeURIComponent(query);
  const justWatchRegion = region.toLowerCase() === "gb" ? "uk" : region.toLowerCase();
  const watchLink = "https://www.justwatch.com/" + justWatchRegion + "/search?q=" + encoded;
  const options = providerSearchOptions(query);
  const lookups: Array<Promise<unknown>> = [];
  const labels: Array<"tv" | "movie"> = [];
  if (mediaType !== "movie") {
    labels.push("tv");
    lookups.push(getJson("https://api.tvmaze.com/search/shows?q=" + encoded));
  }
  if (mediaType !== "tv") {
    labels.push("movie");
    const country = region.toLowerCase();
    lookups.push((async () => {
      let result = await getJson("https://itunes.apple.com/search?term=" + encoded + "&media=movie&entity=movie&limit=10&country=" + country);
      if ((!Array.isArray((result as Record<string, unknown>).results) ||
        ((result as Record<string, unknown>).results as unknown[]).length === 0) && country !== "us") {
        result = await getJson("https://itunes.apple.com/search?term=" + encoded + "&media=movie&entity=movie&limit=10&country=us");
      }
      return result;
    })());
  }

  const settled = await Promise.allSettled(lookups);
  const candidates: Array<{
    type: "tv" | "movie";
    item: any;
    title: string;
    year: string;
    overview: string;
    poster: string | null;
    score: number;
    popularity: number;
  }> = [];
  settled.forEach((result, index) => {
    const type = labels[index];
    if (result.status !== "fulfilled") {
      console.warn("[movie-availability] fallback catalog unavailable:", type);
      return;
    }
    const payload = result.value as Record<string, unknown>;
    if (type === "tv") {
      const entries = Array.isArray(result.value) ? result.value as Array<Record<string, any>> : [];
      entries.forEach((entry) => {
        const show = entry?.show;
        if (!show) return;
        const title = clean(show.name, 160);
        const foundYear = String(show.premiered || "").slice(0, 4);
        const score = scoreMovieCandidate({ title, originalTitle: show.name, year: foundYear }, query, year);
        candidates.push({
          type, item: show, title, year: foundYear,
          overview: clean(String(show.summary || "").replace(/<[^>]*>/g, " "), 500),
          poster: show.image?.original || show.image?.medium || null,
          score, popularity: Number(show.rating?.average || 0),
        });
      });
    } else {
      const results = Array.isArray(payload.results) ? payload.results as Array<Record<string, any>> : [];
      results.forEach((item) => {
        const title = clean(item.trackName, 160);
        const foundYear = String(item.releaseDate || "").slice(0, 4);
        const score = scoreMovieCandidate({ title, originalTitle: item.trackCensoredName, year: foundYear }, query, year);
        candidates.push({
          type, item, title, year: foundYear,
          overview: clean(item.longDescription || item.shortDescription || "", 500),
          poster: typeof item.artworkUrl100 === "string" ? item.artworkUrl100.replace(/100x100bb/i, "600x900bb") : null,
          score, popularity: Number(item.trackCount || 0),
        });
      });
    }
  });

  candidates.sort((a, b) => b.score - a.score || b.popularity - a.popularity);
  const selected = candidates.find((candidate) => candidate.score >= 68);
  if (!selected) {
    return {
      found: true,
      mediaType: mediaType || "unknown",
      movie: { id: null, title: query, year: year ? String(year) : "", overview: "", poster: null },
      region, options, watchLink, message: "No close catalog match was found. Official provider searches are available; availability is not independently verified.",
      source: "official-provider-search", verifiedAvailability: false,
    };
  }
  return {
    found: true,
    mediaType: selected.type,
    movie: {
      id: selected.item?.id ?? selected.item?.trackId ?? null,
      title: selected.title,
      year: selected.year || (year ? String(year) : ""),
      overview: selected.overview,
      poster: selected.poster,
    },
    region, options, watchLink,
    message: "Fallback metadata came from " + (selected.type === "tv" ? "TVmaze" : "Apple Search API") +
      ". Official provider links open external search pages; title availability is not independently verified.",
    source: selected.type === "tv" ? "TVmaze" : "Apple Search API",
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
  const rawQuery = clean(body.title, 200);
  const parsed = parseMovieQuery(rawQuery, body.year, body.mediaType);
  const query = parsed.title;
  const year = parsed.year;
  const mediaType = parsed.mediaType;
  const region = clean(body.region, 2).toUpperCase() || "BD";
  if (query.length < 2) return json({ error: "Enter at least two characters for the title." }, 422, origin);
  if (body.year !== undefined && body.year !== null && body.year !== "" && year === null) {
    return json({ error: "Release year must be between 1870 and 2100." }, 422, origin);
  }
  if (!/^[A-Z]{2}$/.test(region)) return json({ error: "Invalid region code." }, 422, origin);
  const selectedId = body.selectedId === undefined || body.selectedId === null || body.selectedId === ""
    ? null
    : Number(body.selectedId);
  const selectedType = body.selectedType === "movie" || body.selectedType === "tv" ? body.selectedType : null;
  if (selectedId !== null && (!Number.isSafeInteger(selectedId) || selectedId <= 0 || !selectedType)) {
    return json({ error: "Invalid selected movie/series candidate." }, 400, origin);
  }

  const key = Deno.env.get("TMDB_API_KEY")?.trim();
  // Do not fail just because TMDB isn't configured: use public no-key catalogs and official provider search links.
  if (!key) {
    try { return json(await fallbackLookup(query, region, year, mediaType), 200, origin); }
    catch (error) {
      console.error("[movie-availability] fallback failed:", error instanceof Error ? error.message : "request failed");
      return json({ found: true, mediaType: "unknown", movie: { id: null, title: query, year: "", overview: "", poster: null }, region,
        options: providerSearchOptions(query), watchLink: "https://www.justwatch.com/" + region.toLowerCase() + "/search?q=" + encodeURIComponent(query),
        message: "Could not load a poster right now. Official provider search links are available; availability is not independently verified.",
        source: "official-provider-search", verifiedAvailability: false }, 200, origin);
    }
  }
  try {
    let selected: {
      item: Record<string, any>;
      mediaType: SearchMediaType;
      score: number;
    } | null = null;

    if (selectedId !== null && selectedType) {
      const item = await tmdb(selectedType + "/" + selectedId, key);
      const selectedTitle = selectedType === "tv" ? item.name : item.title;
      const selectedYear = String(selectedType === "tv" ? item.first_air_date || "" : item.release_date || "").slice(0, 4);
      selected = {
        item,
        mediaType: selectedType,
        score: scoreMovieCandidate({
          title: selectedTitle,
          originalTitle: selectedType === "tv" ? item.original_name : item.original_title,
          year: selectedYear,
        }, query, year),
      };
    } else {
      const encoded = encodeURIComponent(query);
      const requests: Array<{ mediaType: SearchMediaType; promise: Promise<any> }> = [];
      if (mediaType !== "tv") {
        const movieUrl = new URL("https://api.themoviedb.org/3/search/movie");
        movieUrl.searchParams.set("query", query);
        movieUrl.searchParams.set("include_adult", "false");
        movieUrl.searchParams.set("language", "en-US");
        movieUrl.searchParams.set("page", "1");
        if (year) movieUrl.searchParams.set("year", String(year));
        requests.push({ mediaType: "movie", promise: tmdb(movieUrl.pathname.replace(/^\/3\//, "") + movieUrl.search, key) });
      }
      if (mediaType !== "movie") {
        const tvUrl = new URL("https://api.themoviedb.org/3/search/tv");
        tvUrl.searchParams.set("query", query);
        tvUrl.searchParams.set("include_adult", "false");
        tvUrl.searchParams.set("language", "en-US");
        tvUrl.searchParams.set("page", "1");
        if (year) tvUrl.searchParams.set("first_air_date_year", String(year));
        requests.push({ mediaType: "tv", promise: tmdb(tvUrl.pathname.replace(/^\/3\//, "") + tvUrl.search, key) });
      }
      const searched = await Promise.allSettled(requests.map((request) => request.promise));
      const candidates: ReturnType<typeof rankMovieCandidates>[number][] = [];
      searched.forEach((result, index) => {
        if (result.status !== "fulfilled") {
          console.warn("[movie-availability] TMDB search failed for", requests[index].mediaType);
          return;
        }
        const rows = Array.isArray(result.value.results) ? result.value.results as Array<Record<string, unknown>> : [];
        candidates.push(...rankMovieCandidates(rows, requests[index].mediaType, query, year));
      });
      candidates.sort((a, b) => b.score - a.score || b.voteCount - a.voteCount || b.popularity - a.popularity);
      if (searched.length && searched.every((result) => result.status === "rejected")) {
        throw new Error("All TMDB title-search endpoints failed.");
      }
      if (!candidates.length) {
        return json({
          found: false, query: rawQuery,
          message: "No matching movie or series was found. Try an official title, an alternate title, or add the release year.",
        }, 200, origin);
      }

      if (isAmbiguousMovieMatch(candidates)) {
        const topScore = candidates[0].score;
        const choices = candidates
          .filter((candidate) => candidate.score >= Math.max(30, topScore - 18))
          .slice(0, 5)
          .map((candidate) => ({
            id: candidate.id,
            mediaType: candidate.mediaType,
            title: candidate.title,
            year: candidate.year,
            poster: candidate.poster,
            overview: candidate.overview,
          }));
        return json({
          found: false, query: rawQuery, candidates: choices,
          message: "Several titles are close to your search. Select the correct title and year to check availability.",
          region, source: "TMDB",
        }, 200, origin);
      }
      selected = { item: { ...candidates[0], __rankedCandidate: true }, mediaType: candidates[0].mediaType, score: candidates[0].score };
      // The selected result came from search and already contains all fields needed below.
    }

    if (!selected) {
      return json({ found: false, query: rawQuery, message: "No matching title was found." }, 200, origin);
    }

    const item = selected.item;
    const type = selected.mediaType;
    const id = Number(item.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error("The title catalog returned an invalid result ID.");
    }
    const fromRankedCandidate = item.__rankedCandidate === true;
    const title = clean(fromRankedCandidate ? item.title : (type === "tv" ? item.name : item.title), 160);
    const release = fromRankedCandidate ? item.year : (type === "tv" ? item.first_air_date : item.release_date);
    const resultYear = typeof release === "string" ? release.slice(0, 4) : "";
    const overview = clean(item.overview, 500);
    const posterPath = typeof item.poster_path === "string" && item.poster_path.startsWith("/")
      ? item.poster_path
      : null;
    const posterUrl = fromRankedCandidate
      ? (typeof item.poster === "string" ? item.poster : null)
      : (posterPath ? "https://image.tmdb.org/t/p/w500" + posterPath : null);
    const availability = await tmdb(type + "/" + encodeURIComponent(String(id)) + "/watch/providers", key);
    const regionData = availability.results?.[region] || null;
    const categories = ["free", "ads", "flatrate", "rent", "buy"];
    const options = categories.flatMap((category) => (Array.isArray(regionData?.[category]) ? regionData[category] : []).map((provider: any) => ({
      name: clean(provider.provider_name, 100),
      logo: typeof provider.logo_path === "string" && provider.logo_path.startsWith("/")
        ? "https://image.tmdb.org/t/p/w92" + provider.logo_path
        : null,
      type: category,
      url: typeof regionData?.link === "string" ? regionData.link : "https://www.justwatch.com/" + region.toLowerCase() + "/search?q=" + encodeURIComponent(query),
      verified: true,
    })));
    return json({
      found: true, mediaType: type,
      movie: { id, title, year: resultYear, overview, poster: posterUrl },
      region, options,
      watchLink: typeof regionData?.link === "string" ? regionData.link : "https://www.justwatch.com/" + (region.toLowerCase() === "gb" ? "uk" : region.toLowerCase()) + "/search?q=" + encodeURIComponent(query),
      message: options.length ? "Availability information supplied by TMDB/JustWatch." : "No verified streaming provider data was returned for this region.",
      source: "TMDB/JustWatch", verifiedAvailability: options.length > 0,
    }, 200, origin);
  } catch (error) {
    console.error("[movie-availability]", error instanceof Error ? error.message : "request failed");
    try {
      return json({
        ...(await fallbackLookup(query, region, year, mediaType)),
        message: "TMDB could not confirm current availability. Fallback metadata and official provider searches are available instead.",
        verifiedAvailability: false,
      }, 200, origin);
    } catch {
      const options = providerSearchOptions(query);
      return json({
        found: true, mediaType: mediaType || "unknown",
        movie: { id: null, title: query, year: year ? String(year) : "", overview: "", poster: null },
        region, options,
        watchLink: "https://www.justwatch.com/" + (region.toLowerCase() === "gb" ? "uk" : region.toLowerCase()) + "/search?q=" + encodeURIComponent(query),
        message: "The title catalog is temporarily unavailable. Official provider search links are available; availability is not independently verified.",
        source: "official-provider-search", verifiedAvailability: false,
      }, 200, origin);
    }
  }
});
