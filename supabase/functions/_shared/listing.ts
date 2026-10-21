import { baseDomain, normalizeUrlKey, parsePublicUrl } from "./urls.ts";

export const SECTIONS = ["movie", "series", "sites", "apps", "music"] as const;
export type Section = typeof SECTIONS[number];
export type ListingRow = Record<string, unknown>;

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

function optUrl(v: unknown, field: string, errors: Record<string, string>): string | null {
  if (v === undefined || v === null || v === "") return null;
  const u = parsePublicUrl(v);
  if (!u) { errors[field] = "Must be a valid public https:// URL."; return null; }
  return u.href;
}
function optInt(v: unknown, min: number, max: number, field: string, errors: Record<string, string>): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) { errors[field] = `Must be a whole number from ${min} to ${max}.`; return null; }
  return n;
}

/** Validates admin input and returns a DB-ready row (never trusts the client). */
export function validateListing(input: Record<string, unknown>): { row?: ListingRow; errors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const section = String(input.section ?? "") as Section;
  if (!SECTIONS.includes(section)) errors.section = "Choose where this listing is shown.";
  const category = clean(input.category, 60);
  if (!category) errors.category = "Category is required.";
  const name = clean(input.name, 160);
  if (!name) errors.name = "Name is required.";

  const dest = parsePublicUrl(input.url);
  if (!dest) errors.url = "Enter a valid public https:// URL.";

  const description = clean(input.description, 1500) || null;
  const logo = optUrl(input.logo_url, "logo_url", errors);
  const poster = optUrl(input.poster_url, "poster_url", errors);
  const official = optUrl(input.official_url, "official_url", errors);
  const download = optUrl(input.download_url, "download_url", errors);

  const year = optInt(input.year, 1870, 2100, "year", errors);
  const seasons = optInt(input.season_count, 0, 5000, "season_count", errors);
  const episodes = optInt(input.episode_count, 0, 100000, "episode_count", errors);

  let imdbId: string | null = null;
  const rawImdb = clean(input.imdb_id, 200);
  if (rawImdb) {
    const m = rawImdb.match(/tt\d{5,10}/);
    if (!m) errors.imdb_id = "Enter an IMDb id like tt1234567 or an IMDb title URL."; else imdbId = m[0];
  }
  let rating: number | null = null;
  if (input.imdb_rating !== undefined && input.imdb_rating !== null && input.imdb_rating !== "") {
    const n = Number(input.imdb_rating);
    if (!Number.isFinite(n) || n < 0 || n > 10) errors.imdb_rating = "Rating must be between 0 and 10."; else rating = Math.round(n * 10) / 10;
  }
  const genres = (Array.isArray(input.genres) ? input.genres : [])
    .map((g) => clean(g, 40)).filter(Boolean).slice(0, 12);
  const ads = Number(input.ads ?? 1);
  if (![0, 1, 2].includes(ads)) errors.ads = "Ad level must be 0, 1 or 2.";

  if (Object.keys(errors).length) return { errors };
  return {
    row: {
      section, category, name, url: dest!.href, url_key: normalizeUrlKey(dest!.href),
      description, logo_url: logo, poster_url: poster, year, genres,
      imdb_id: imdbId, imdb_rating: rating, season_count: section === "series" ? seasons : null,
      episode_count: section === "series" ? episodes : null,
      official_url: official, download_url: download, download_verified: false,
      platform: clean(input.platform, 60) || null, version: clean(input.version, 60) || null,
      ads, published: true,
    },
  };
}

export { baseDomain };
