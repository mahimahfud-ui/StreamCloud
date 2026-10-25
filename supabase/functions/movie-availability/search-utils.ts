export type SearchMediaType = "movie" | "tv";
export type ParsedMovieQuery = {
  title: string;
  year: number | null;
  mediaType: SearchMediaType | null;
};

export type RankedMovieCandidate = {
  id: number;
  mediaType: SearchMediaType;
  title: string;
  originalTitle: string;
  year: string;
  poster: string | null;
  overview: string;
  score: number;
  popularity: number;
  voteCount: number;
};

function safeText(value: unknown, max = 200): string {
  return typeof value === "string"
    ? value.trim().replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").slice(0, max)
    : "";
}

export function normalizeTitle(value: unknown): string {
  return safeText(value, 200)
    .normalize("NFKD")
    .replace(/([\p{Script=Latin}])\p{M}+/gu, "$1")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function validYear(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1870 && value <= 2100) return value;
  if (typeof value === "string" && /^\d{4}$/.test(value.trim())) {
    const year = Number(value.trim());
    return year >= 1870 && year <= 2100 ? year : null;
  }
  return null;
}

export function parseMovieQuery(value: unknown, yearOverride?: unknown, mediaOverride?: unknown): ParsedMovieQuery {
  let title = safeText(value, 200);
  let mediaType: SearchMediaType | null = null;
  const startType = title.match(/^(movie|film|series|web\s*series|tv|show)\s*:\s*/i);
  if (startType) {
    mediaType = /^(series|web\s*series|tv|show)$/i.test(startType[1].replace(/\s+/g, " "))
      ? "tv"
      : "movie";
    title = title.slice(startType[0].length).trim();
  }
  const endType = title.match(/\s+(series|web\s*series|tv\s*show|movie|film)$/i);
  if (endType) {
    mediaType = /series|tv\s*show/i.test(endType[1]) ? "tv" : "movie";
    title = title.slice(0, endType.index).trim();
  }
  let year = validYear(yearOverride);
  if (year === null) {
    const suffix = title.match(/\s*[\[(]?\s*((?:18|19|20)\d{2})\s*[\])]?\s*$/);
    if (suffix) {
      year = validYear(suffix[1]);
      title = title.slice(0, suffix.index).trim().replace(/[([]\s*$/, "").trim();
    }
  }
  if (mediaOverride === "movie" || mediaOverride === "tv") mediaType = mediaOverride;
  return { title: safeText(title, 160), year, mediaType };
}

function editDistance(a: string, b: string): number {
  if (!a) return b.length;
  if (!b) return a.length;
  // Cap the work even if an upstream title is unexpectedly long.
  a = a.slice(0, 120);
  b = b.slice(0, 120);
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

function scoreOne(candidate: string, query: string): number {
  const title = normalizeTitle(candidate);
  if (!title || !query) return 0;
  if (title === query) return 100;
  if (title.startsWith(query + " ")) return 87;
  if (query.startsWith(title + " ")) return 82;
  if ((" " + title + " ").includes(" " + query + " ")) return 84;
  if (title.includes(query)) return 75;
  if (query.includes(title)) return 69;

  const queryTokens = query.split(" ").filter(Boolean);
  const titleTokens = title.split(" ").filter(Boolean);
  const titleSet = new Set(titleTokens);
  const common = queryTokens.filter((token) => titleSet.has(token)).length;
  const coverage = common / Math.max(1, queryTokens.length);
  const precision = common / Math.max(1, titleTokens.length);
  const tokenScore = 48 * coverage + 24 * precision;

  const maxLength = Math.max(query.length, title.length);
  const similarity = maxLength ? 1 - editDistance(query, title) / maxLength : 0;
  const typoScore = similarity >= 0.58 ? similarity * 82 : 0;
  return Math.round(Math.max(tokenScore, typoScore));
}

export function scoreMovieCandidate(candidate: {
  title?: unknown;
  originalTitle?: unknown;
  year?: unknown;
}, query: string, requestedYear: number | null = null): number {
  const q = normalizeTitle(query);
  if (!q) return 0;
  const aliases = [candidate.title, candidate.originalTitle]
    .map(normalizeTitle)
    .filter(Boolean);
  let score = aliases.reduce((best, title) => Math.max(best, scoreOne(title, q)), 0);
  const candidateYear = validYear(candidate.year);
  if (requestedYear !== null) {
    if (candidateYear === requestedYear) score += 15;
    else if (candidateYear !== null) score -= 28;
    else score -= 5;
  }
  return Math.max(0, Math.min(115, Math.round(score)));
}

export function rankMovieCandidates(
  rows: Array<Record<string, unknown>>,
  mediaType: SearchMediaType,
  query: string,
  requestedYear: number | null,
): RankedMovieCandidate[] {
  return rows.map((row) => {
    const rawTitle = mediaType === "tv" ? row.name : row.title;
    const original = mediaType === "tv" ? row.original_name : row.original_title;
    const date = mediaType === "tv" ? row.first_air_date : row.release_date;
    const year = typeof date === "string" ? date.slice(0, 4) : "";
    const id = Number(row.id);
    return {
      id,
      mediaType,
      title: safeText(rawTitle, 160),
      originalTitle: safeText(original, 160),
      year,
      poster: typeof row.poster_path === "string" && row.poster_path.startsWith("/")
        ? "https://image.tmdb.org/t/p/w500" + row.poster_path
        : null,
      overview: safeText(row.overview, 500),
      score: scoreMovieCandidate({ title: rawTitle, originalTitle: original, year }, query, requestedYear),
      popularity: Number.isFinite(Number(row.popularity)) ? Number(row.popularity) : 0,
      voteCount: Number.isFinite(Number(row.vote_count)) ? Number(row.vote_count) : 0,
    };
  }).filter((row) => Number.isSafeInteger(row.id) && row.id > 0 && !!row.title)
    .sort((a, b) => b.score - a.score || b.voteCount - a.voteCount || b.popularity - a.popularity);
}

export function isAmbiguousMovieMatch(candidates: RankedMovieCandidate[]): boolean {
  if (!candidates.length) return false;
  const first = candidates[0];
  const second = candidates[1];
  if (first.score < 68) return true;
  return !!second && first.score >= 80 && second.score >= 80 &&
    first.score - second.score <= 3 &&
    (first.id !== second.id || first.mediaType !== second.mediaType);
}
