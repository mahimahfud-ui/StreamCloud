// Build-time TMDB metadata fetch. API keys are read from environment variables only.
// Input: data/recommendations.json -> { movies: [...], series: [...] }
// Output: data/tmdb/index.json and data/tmdb/<movie|series>-<id>.json
import { readFile, writeFile, readdir, unlink, mkdir } from "node:fs/promises";

const BASE = process.env.TMDB_API_BASE || "https://api.themoviedb.org/3";
const KEY = process.env.TMDB_API_KEY;
const TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;
const OMDB = process.env.OMDB_API_KEY;
const OMDB_BASE = process.env.OMDB_API_BASE || "https://www.omdbapi.com/";
const OUT = new URL("../data/tmdb/", import.meta.url);
const SRC = new URL("../data/recommendations.json", import.meta.url);
const warn = message => console.log("::warning::" + message);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const norm = value => String(value || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const today = new Date().toISOString().slice(0, 10);

if (!KEY && !TOKEN) {
  console.log("TMDB_API_KEY / TMDB_READ_ACCESS_TOKEN not set; keeping any existing data/tmdb files.");
  process.exit(0);
}

async function tmdb(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [key, value] of Object.entries(params)) if (value != null) url.searchParams.set(key, value);
  if (KEY && !TOKEN) url.searchParams.set("api_key", KEY);
  for (let attempt = 0; attempt < 4; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        headers: TOKEN ? { Authorization: "Bearer " + TOKEN } : {},
        signal: AbortSignal.timeout(15000)
      });
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(600 * (attempt + 1));
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      if (attempt === 3) throw new Error("TMDB " + response.status + " " + path);
      await sleep((Number(response.headers.get("retry-after")) || 1 + attempt) * 1000);
      continue;
    }
    if (!response.ok) throw new Error("TMDB " + response.status + " " + path);
    return response.json();
  }
  throw new Error("TMDB request failed: " + path);
}

async function resolveId(entry, type) {
  if (entry.tmdbId) return entry.tmdbId;
  const isSeries = type === "series";
  const results = (await tmdb(isSeries ? "/search/tv" : "/search/movie", {
    query: entry.title,
    language: "en-US",
    include_adult: "false",
    [isSeries ? "first_air_date_year" : "year"]: entry.year
  })).results || [];
  const names = result => [result.title, result.original_title, result.name, result.original_name].map(norm);
  const exact = results.filter(result => names(result).includes(norm(entry.title)));
  if (exact.length > 1 && !entry.year) {
    warn('"' + entry.title + '" matches several titles; add "tmdbId" to resolve the right one.');
  }
  const picked = exact.sort((a, b) => b.popularity - a.popularity)[0] || results[0];
  if (!picked) throw new Error('no TMDB match for "' + entry.title + '"');
  return picked.id;
}

async function imdbRating(imdbId) {
  if (!OMDB || !imdbId) return null;
  try {
    const url = new URL(OMDB_BASE);
    url.searchParams.set("i", imdbId);
    url.searchParams.set("apikey", OMDB);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    const value = parseFloat(data.imdbRating);
    return data.Response === "True" && Number.isFinite(value)
      ? { value, votes: parseInt(String(data.imdbVotes).replace(/,/g, ""), 10) || null }
      : null;
  } catch {
    return null;
  }
}

async function build(entry, type) {
  const isSeries = type === "series";
  const id = await resolveId(entry, type);
  const detailsPath = "/" + (isSeries ? "tv" : "movie") + "/" + id;
  const data = await tmdb(detailsPath, { language: "en-US", append_to_response: "external_ids" });
  const imdbId = (data.external_ids && data.external_ids.imdb_id) || data.imdb_id || null;
  let overview = data.overview || "";
  let overviewLanguage = null;
  if (!overview && data.original_language && data.original_language !== "en") {
    try {
      overview = (await tmdb(detailsPath, { language: data.original_language })).overview || "";
      if (overview) overviewLanguage = data.original_language;
    } catch {}
  }
  const title = (isSeries ? data.name : data.title) || entry.title;
  const original = isSeries ? data.original_name : data.original_title;
  const date = (isSeries ? data.first_air_date : data.release_date) || "";
  const imdb = await imdbRating(imdbId);
  const item = {
    key: type + "-" + id,
    id,
    type,
    title,
    originalTitle: original && norm(original) !== norm(title) ? original : null,
    year: date ? Number(date.slice(0, 4)) : null,
    poster: data.poster_path || null,
    genres: (data.genres || []).map(genre => genre.name),
    language: data.original_language || null,
    rating: data.vote_count > 0 ? { source: "TMDB", value: Math.round(data.vote_average * 10) / 10, votes: data.vote_count } : null,
    imdb: imdb ? Object.assign({}, imdb, { id: imdbId }) : null
  };
  const detail = Object.assign({}, item, {
    overview,
    overviewLanguage,
    tagline: data.tagline || "",
    status: data.status || "",
    releaseDate: date || null,
    imdbId,
    note: entry.note || ""
  });
  if (!isSeries) {
    detail.runtime = data.runtime || null;
    return { item, detail };
  }

  const seasons = [];
  for (const season of (data.seasons || []).filter(value => value.season_number > 0)) {
    let episodes = null;
    try {
      episodes = ((await tmdb("/tv/" + id + "/season/" + season.season_number, { language: "en-US" })).episodes || [])
        .map(episode => ({
          n: episode.episode_number,
          name: episode.name || "",
          airDate: episode.air_date || null,
          runtime: episode.runtime || null
        }));
    } catch (error) {
      warn(title + " season " + season.season_number + ": " + error.message + " (using TMDB season episode_count)");
    }
    seasons.push({
      number: season.season_number,
      name: season.name || ("Season " + season.season_number),
      airDate: season.air_date || null,
      episodeCount: episodes ? episodes.length : season.episode_count || 0,
      episodes
    });
  }
  const totalEpisodes = seasons.reduce((total, season) => total + season.episodeCount, 0);
  const airedEpisodes = seasons.reduce((total, season) => {
    return total + (season.episodes
      ? season.episodes.filter(episode => episode.airDate && episode.airDate <= today).length
      : (season.airDate && season.airDate <= today ? season.episodeCount : 0));
  }, 0);
  item.seasons = seasons.length;
  item.episodes = totalEpisodes;
  detail.seasons = seasons.sort((a, b) => a.number - b.number);
  detail.seasonCount = seasons.length;
  detail.episodeCount = totalEpisodes;
  detail.airedEpisodes = airedEpisodes;
  detail.inProduction = !!data.in_production;
  return { item, detail };
}

async function readJSON(url, fallback) {
  try { return JSON.parse(await readFile(url, "utf8")); } catch { return fallback; }
}
async function writeIfChanged(url, value) {
  const text = JSON.stringify(value) + "\n";
  try { if (await readFile(url, "utf8") === text) return; } catch {}
  await writeFile(url, text);
}

const source = await readJSON(SRC, null);
if (!source || typeof source !== "object") {
  console.error("data/recommendations.json is missing or invalid JSON.");
  process.exit(1);
}
await mkdir(OUT, { recursive: true });
const previousData = await readJSON(new URL("index.json", OUT), { items: [] });
const previous = new Map(((previousData && previousData.items) || []).map(item => [
  item.type + ":" + norm(item.sourceTitle) + ":" + (item.sourceId || ""), item
]));
const items = [];
const keep = new Set(["index.json"]);
for (const [list, type] of [[source.movies, "movie"], [source.series, "series"]]) {
  for (const raw of Array.isArray(list) ? list : []) {
    const entry = typeof raw === "string" ? { title: raw } : raw;
    if (!entry || (!entry.title && !entry.tmdbId)) {
      warn("Skipped an invalid " + type + " entry.");
      continue;
    }
    const previousKey = type + ":" + norm(entry.title) + ":" + (entry.tmdbId || "");
    try {
      const result = await build(entry, type);
      result.item.sourceTitle = entry.title || "";
      result.item.sourceId = entry.tmdbId || "";
      items.push(result.item);
      keep.add(result.item.key + ".json");
      await writeIfChanged(new URL(result.item.key + ".json", OUT), result.detail);
      console.log("ok " + type + " " + result.item.title + " (" + result.item.key + ")");
    } catch (error) {
      warn(type + ' "' + (entry.title || entry.tmdbId) + '": ' + error.message);
      const old = previous.get(previousKey);
      if (old) {
        items.push(old);
        keep.add(old.key + ".json");
        console.log("kept previous data for " + old.title);
      }
    }
  }
}
await writeIfChanged(new URL("index.json", OUT), { items });
for (const file of await readdir(OUT)) {
  if (file.endsWith(".json") && !keep.has(file)) await unlink(new URL(file, OUT));
}
console.log("Done: " + items.length + " titles.");
