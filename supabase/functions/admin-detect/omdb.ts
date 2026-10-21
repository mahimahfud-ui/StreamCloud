// IMDb data via OMDb (https://www.omdbapi.com). Only exact, verifiable matches are accepted.
export type OmdbData = {
  imdbId: string; title: string; year: number | null; rating: number | null; genres: string[];
  plot: string | null; poster: string | null; seasons: number | null; episodes: number | null;
};
type Result = { status: "ok" | "no-key" | "not-found" | "type-mismatch"; data?: OmdbData };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const na = (v: unknown) => (typeof v === "string" && v !== "N/A" && v.trim() ? v.trim() : null);

async function call(params: Record<string, string>, key: string) {
  const qs = new URLSearchParams({ apikey: key, ...params });
  const res = await fetch(`https://www.omdbapi.com/?${qs}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OMDb returned ${res.status}.`);
  return await res.json();
}

export async function omdbLookup(q: { imdbId?: string; title: string; year: number | null; type: "movie" | "series" }): Promise<Result> {
  const key = Deno.env.get("OMDB_API_KEY");
  if (!key) return { status: "no-key" };
  let d;
  if (q.imdbId) d = await call({ i: q.imdbId, plot: "short" }, key);
  else {
    if (!q.title) return { status: "not-found" };
    d = await call({ t: q.title, type: q.type, plot: "short", ...(q.year ? { y: String(q.year) } : {}) }, key);
    if (d.Response === "True") {
      const yr = parseInt(String(d.Year), 10);
      if (norm(String(d.Title)) !== norm(q.title) || (q.year && yr !== q.year)) return { status: "not-found" };
    }
  }
  if (d.Response !== "True") return { status: "not-found" };
  if ((d.Type === "series") !== (q.type === "series") && (d.Type === "movie" || d.Type === "series")) return { status: "type-mismatch" };

  const rating = na(d.imdbRating) ? Number(d.imdbRating) : null;
  let seasons: number | null = null, episodes: number | null = null;
  if (q.type === "series" && na(d.totalSeasons) && /^\d+$/.test(d.totalSeasons)) {
    seasons = Number(d.totalSeasons);
    if (seasons >= 1 && seasons <= 40) {
      try {
        const all = await Promise.all(Array.from({ length: seasons }, (_, i) => call({ i: d.imdbID, Season: String(i + 1) }, key)));
        episodes = all.every((s) => s.Response === "True" && Array.isArray(s.Episodes))
          ? all.reduce((n, s) => n + s.Episodes.length, 0) : null;
      } catch { episodes = null; }
    }
  }
  return {
    status: "ok",
    data: {
      imdbId: d.imdbID, title: String(d.Title), year: na(d.Year) ? parseInt(d.Year, 10) || null : null,
      rating: rating !== null && Number.isFinite(rating) ? rating : null,
      genres: na(d.Genre) ? String(d.Genre).split(",").map((g: string) => g.trim()).filter(Boolean) : [],
      plot: na(d.Plot), poster: na(d.Poster) && /^https:\/\//.test(d.Poster) ? d.Poster : null, seasons, episodes,
    },
  };
}
