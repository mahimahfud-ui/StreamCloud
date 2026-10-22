import { json, preflight, readJson } from "../_shared/http.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { baseDomain, parsePublicUrl, readLimited, safeFetch } from "../_shared/urls.ts";
import { verifyApk } from "../_shared/apk.ts";
import { extractPage, type PageInfo } from "./page.ts";
import { askGemini } from "./gemini.ts";
import { askAutoAI } from "./ai-router.ts";
import { omdbLookup } from "./omdb.ts";

type Detected = Record<string, unknown>;
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

async function verifyImage(raw: string): Promise<boolean> {
  try {
    const { res } = await safeFetch(new URL(raw), { headers: { Range: "bytes=0-1023" }, timeoutMs: 6000 });
    if (res.status !== 200 && res.status !== 206) { await res.body?.cancel(); return false; }
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    const b = await readLimited(res, 16);
    const magic = (b[0] === 0x89 && b[1] === 0x50) || (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x47 && b[1] === 0x49) ||
      (b[0] === 0x52 && b[1] === 0x49) || (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) || new TextDecoder().decode(b).includes("<");
    return type.startsWith("image/") || (magic && !type.startsWith("text/html"));
  } catch { return false; }
}

async function pickLogo(page: PageInfo | null, origin: URL): Promise<string | null> {
  // Prefer a real site icon; Open Graph/JSON-LD images are useful fallbacks for sites
  // whose favicon is missing or unreadable.
  const candidates = [...(page?.icons ?? []).slice(0, 4), ...(page?.images ?? []).slice(0, 8), new URL("/favicon.ico", origin).href];
  for (const c of [...new Set(candidates)].slice(0, 10)) if (parsePublicUrl(c) && await verifyImage(c)) return c;
  return null;
}

async function pickPageImage(page: PageInfo | null): Promise<string | null> {
  if (!page) return null;
  for (const c of (page.images ?? []).slice(0, 8)) {
    if (parsePublicUrl(c) && await verifyImage(c)) return c;
  }
  return null;
}

/** GitHub repos: use the official Releases API for APK assets. */
async function githubApk(u: URL, notes: string[]) {
  const m = u.pathname.match(/^\/([\w.-]+)\/([\w.-]+)/);
  if (!m) return null;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "StreamCloudBot/1.0" };
  const gh = Deno.env.get("GITHUB_TOKEN"); if (gh && gh.trim() !== "এপিয়াই") headers.Authorization = `Bearer ${gh}`;
  try {
    const repo = await (await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}`, { headers, signal: AbortSignal.timeout(8000) })).json();
    const rel = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}/releases/latest`, { headers, signal: AbortSignal.timeout(8000) });
    let apk: string | null = null, version: string | null = null;
    if (rel.ok) {
      const r = await rel.json();
      version = typeof r.tag_name === "string" ? r.tag_name : null;
      const apks = (r.assets ?? []).filter((a: { name?: string }) => /\.apk$/i.test(a.name ?? ""));
      const pick = apks.length === 1 ? apks[0] : apks.find((a: { name: string }) => /universal/i.test(a.name));
      if (pick) apk = pick.browser_download_url; else if (apks.length) notes.push(`The latest release has ${apks.length} APK files; choose one manually.`);
    }
    return { name: repo.name as string | undefined, description: repo.description as string | undefined, logo: repo.owner?.avatar_url as string | undefined, apk, version };
  } catch { return null; }
}

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (!(await requireAdmin(req))) return json(req, { error: "Admin session expired. Enter the PIN again." }, 401);

  const body = await readJson(req, 4_000);
  if (!body) return json(req, { error: "Invalid request." }, 400);
  const section = String(body.section ?? "sites");

  if (body.mode === "title-lookup") {
    if (section !== "movie" && section !== "series") return json(req, { error: "Choose Movie or Web Series." }, 422);
    const title = typeof body.title === "string" ? body.title.trim().replace(/\s+/g, " ").slice(0, 160) : "";
    const rawYear = body.year;
    const year = rawYear === null || rawYear === "" || rawYear === undefined ? null : Number(rawYear);
    if (title.length < 2) return json(req, { error: "Enter a title with at least two characters." }, 422);
    if (year !== null && (!Number.isInteger(year) || year < 1870 || year > 2100)) return json(req, { error: "Release year must be between 1870 and 2100." }, 422);
    try {
      const match = await omdbLookup({ title, year, type: section === "series" ? "series" : "movie" });
      if (match.status === "no-key") return json(req, { error: "OMDB_API_KEY is not configured on the server. Add it to Supabase Secrets to use title lookup." }, 503);
      if (match.status === "not-found") return json(req, { error: "No exact title match was verified. Check spelling or add the IMDb URL and use Detect with AI." }, 404);
      if (match.status === "type-mismatch") return json(req, { error: "IMDb identifies this as the other title type. Switch Movie / Web Series and try again." }, 422);
      if (!match.data) return json(req, { error: "No verified metadata was returned." }, 502);
      const d = match.data;
      const notes: string[] = ["Core title metadata was matched through OMDb using an exact title" + (year ? " and year" : "") + "."];
      let description = d.plot;
      if (body.generateSummary === true && d.plot) {
        try {
          const source: PageInfo = {
            html: "", title: d.title, siteName: null, description: d.plot,
            canonical: "https://www.imdb.com/title/" + d.imdbId + "/",
            icons: [], images: d.poster ? [d.poster] : [], imdbIds: [d.imdbId], apkLinks: [],
            text: "Verified synopsis from OMDb: " + d.plot,
            jsonLd: [],
            structured: { name: d.title, description: d.plot, image: d.poster, year: d.year, genres: d.genres, platform: null, version: null },
          };
          const auto = await askAutoAI(source, section, "summary");
          notes.push(auto.note);
          if (auto.result?.description && auto.result.description.length > 20) {
            description = auto.result.description;
            notes.push("AI generated a shorter synopsis using only the verified plot. Confirm it before publishing.");
          } else notes.push("AI summary was unavailable; the verified OMDb plot is shown instead.");
      }
      const imdbUrl = "https://www.imdb.com/title/" + d.imdbId + "/";
      const detected: Detected = {
        url: imdbUrl, name: d.title, year: d.year, genres: d.genres, imdb_id: d.imdbId,
        imdb_rating: d.rating, poster_url: d.poster, description,
      };
      if (section === "series") {
        detected.season_count = d.seasons;
        detected.episode_count = d.episodes;
        if (d.seasons === null) notes.push("Season count was not supplied by OMDb.");
        if (d.episodes === null) notes.push("Episode count could not be verified from OMDb.");
      }
      return json(req, { detected, verified: { imdb: true, logo: false, download: false }, notes, source: "OMDb/IMDb" });
    } catch (error) {
      return json(req, { error: (error as Error).message || "Title lookup failed." }, 502);
    }
  }

  const target = parsePublicUrl(body.url);
  if (!target) return json(req, { error: "Enter a valid public https:// URL." }, 400);
  const notes: string[] = [];
  const out: Detected = { url: target.href };
  const verified = { imdb: false, download: false, logo: false };
  const isTitle = section === "movie" || section === "series";
  const isApp = section === "apps" || section === "music";

  // 1. Read the submitted page (size/time limited, SSRF-guarded).
  let page: PageInfo | null = null;
  const looksApk = /\.apk$/i.test(target.pathname);
  if (!looksApk) {
    try {
      const { res, url } = await safeFetch(target, { headers: { Accept: "text/html,application/xhtml+xml" } });
      const type = (res.headers.get("content-type") ?? "").toLowerCase();
      if (res.ok && (type.includes("html") || type === "")) {
        page = extractPage(new TextDecoder().decode(await readLimited(res, 600_000)), url);
      } else { await res.body?.cancel(); notes.push(`The page could not be read (status ${res.status}). Fill the fields manually.`); }
    } catch (e) { notes.push(`The page could not be read: ${(e as Error).message}. Fill the fields manually.`); }
  }

  // 2. Automatically select an AI provider for this task and fail over on errors.
  let ai: Awaited<ReturnType<typeof askGemini>> = null;
  if (page) {
    const auto = await askAutoAI(page, section, "metadata");
    ai = auto.result;
    notes.push(auto.note);
  }
  // Keep usable page metadata as a fallback when AI providers fail or return
  // only some fields. Many directory pages expose details in JSON-LD/OG tags.
  const structured = page?.structured;
  out.name = ai?.name || structured?.name || (isTitle ? page?.title : page?.siteName || page?.title) || null;
  out.description = ai?.description || structured?.description || page?.description || null;
  out.year = ai?.year ?? structured?.year ?? null;
  out.genres = ai?.genres?.length ? ai.genres : structured?.genres ?? [];
  out.platform = (isApp ? ai?.platform : null) || (isApp ? structured?.platform : null) || null;
  out.version = (isApp ? ai?.version : null) || (isApp ? structured?.version : null) || null;

  // A page's Open Graph/JSON-LD image is often its thumbnail/poster. Verify it
  // before returning it, then let a verified OMDb poster take precedence.
  if (isTitle) {
    const pageImage = await pickPageImage(page);
    if (pageImage) out.poster_url = pageImage;
  }

  // 3. Movies / series: verify against OMDb (IMDb data). Nothing is guessed.
  if (isTitle) {
    const fromUrl = target.hostname.endsWith("imdb.com") ? target.pathname.match(/tt\d{5,10}/)?.[0] : undefined;
    const pageId = page?.imdbIds.find(Boolean);
    const aiId = ai?.imdbId && page?.html.includes(ai.imdbId) ? ai.imdbId : undefined;
    const imdbId = fromUrl ?? pageId ?? aiId;
    try {
      const o = await omdbLookup({ imdbId, title: String(out.name ?? ""), year: out.year as number | null, type: section === "series" ? "series" : "movie" });
      if (o.status === "no-key") notes.push("OMDB_API_KEY is not set on the server, so IMDb data was not verified.");
      else if (o.status === "not-found") notes.push("Could not verify this title on IMDb. Rating, year, seasons and episodes were left empty.");
      else if (o.status === "type-mismatch") notes.push(`IMDb lists this as a ${section === "series" ? "movie" : "series"}. Check the category.`);
      else if (o.data) {
        verified.imdb = true;
        const d = o.data;
        Object.assign(out, {
          name: d.title, year: d.year, genres: d.genres, imdb_id: d.imdbId, imdb_rating: d.rating,
          poster_url: d.poster || out.poster_url || null, description: d.plot ?? out.description,
        });
        if (section === "series") { out.season_count = d.seasons; out.episode_count = d.episodes; if (d.episodes === null) notes.push("Episode count could not be verified."); }
        if (!imdbId) notes.push("Matched by exact title" + (out.year ? " and year" : "") + ". Check it is the right title.");
      }
    } catch (e) { notes.push(`IMDb lookup failed: ${(e as Error).message}`); }
  }

  // 4. Apps: logo, official site, verified direct APK link only.
  if (isApp || section === "sites") {
    out.logo_url = await pickLogo(page, target);
    verified.logo = !!out.logo_url;
    if (!out.description) out.description = page?.structured?.description || page?.description || null;
  }
  if (isApp) {
    let apkCandidate: string | null = looksApk ? target.href : null;
    if (target.hostname === "github.com") {
      const gh = await githubApk(target, notes);
      if (gh) {
        out.name = out.name && out.name !== "GitHub" ? out.name : gh.name ?? out.name;
        out.description = out.description || gh.description || null;
        if (!out.logo_url && gh.logo && await verifyImage(gh.logo)) { out.logo_url = gh.logo; verified.logo = true; }
        if (gh.apk) apkCandidate = gh.apk;
        if (gh.version) { out.version = out.version || gh.version; }
        out.official_url = target.href;
      }
    } else if (page) {
      out.official_url = page.canonical && parsePublicUrl(page.canonical)?.hostname.endsWith(baseDomain(target.hostname)) ? page.canonical : target.origin + "/";
      const same = page.apkLinks.filter((l) => {
        const h = new URL(l);
        return baseDomain(h.hostname) === baseDomain(target.hostname) || (h.hostname === "github.com" && /\/releases\/download\//.test(h.pathname));
      });
      const other = page.apkLinks.filter((l) => !same.includes(l));
      apkCandidate = apkCandidate ?? same[0] ?? null;
      if (!apkCandidate && other.length) notes.push(`An APK link was found on another domain (${new URL(other[0]).hostname}); it was not treated as official.`);
    }
    if (apkCandidate) {
      const v = await verifyApk(apkCandidate);
      if (v.ok) { out.download_url = apkCandidate; verified.download = true; out.platform = out.platform ?? "Android"; }
      else notes.push(`APK link found but not verified (${v.reason}). Left empty.`);
    } else notes.push("No verified direct APK link was found. Add one manually if you have it.");
  }

  // 5. Sanity: never keep a name that is just a generic site label.
  if (typeof out.name === "string") out.name = out.name.slice(0, 160);
  if (typeof out.description === "string") out.description = norm(out.description) ? out.description.slice(0, 600) : null;
  return json(req, { detected: out, verified, notes });
});
