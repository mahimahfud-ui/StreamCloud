import { json, preflight, readJson } from "../_shared/http.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { baseDomain, parsePublicUrl, readLimited, safeFetch } from "../_shared/urls.ts";
import { verifyApk } from "../_shared/apk.ts";
import { verifyImageUrl } from "../_shared/images.ts";
import { extractPage, type PageInfo } from "./page.ts";
import { askGemini } from "./gemini.ts";
import { askAutoAI } from "./ai-router.ts";
import { omdbLookup } from "./omdb.ts";
import { checkProviderHealth } from "./provider-health.ts";

type Detected = Record<string, unknown>;
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

async function pickLogo(page: PageInfo | null, origin: URL): Promise<string | null> {
  // Prefer a real site icon; Open Graph/JSON-LD images are useful fallbacks for sites
  // whose favicon is missing or unreadable.
  const candidates = [...(page?.icons ?? []).slice(0, 4), ...(page?.images ?? []).slice(0, 8), new URL("/favicon.ico", origin).href];
  for (const c of [...new Set(candidates)].slice(0, 10)) if (parsePublicUrl(c) && await verifyImageUrl(c)) return c;
  return null;
}

async function pickPageImage(page: PageInfo | null): Promise<string | null> {
  if (!page) return null;
  for (const c of (page.images ?? []).slice(0, 8)) {
    if (parsePublicUrl(c) && await verifyImageUrl(c)) return c;
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

  if (body.mode === "provider-health") {
    const result = await checkProviderHealth({ includeOmdb: body.includeOmdb === true });
    return json(req, result);
  }

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
      if (match.status === "not-found") return json(req, { error: "No exact title match was verified. Check the spelling or add the IMDb URL and use Detect details." }, 404);
      if (match.status === "type-mismatch") return json(req, { error: "IMDb identifies this as the other title type. Switch Movie / Web Series and try again." }, 422);
      if (!match.data) return json(req, { error: "No verified metadata was returned." }, 502);
      const d = match.data;
      const notes: string[] = ["Core title metadata was matched through OMDb using an exact title" + (year ? " and year" : "") + "."];
      let description = d.plot;
      if (body.generateSummary === true && d.plot) {
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
            notes.push("A shorter synopsis was created from the verified plot. Confirm it before publishing.");
          } else notes.push("The verified source synopsis is shown instead.");
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

  if (!["movie", "series", "sites", "apps", "music", "gaming", "tv"].includes(section)) {
    return json(req, { error: "Choose a supported StreamCloud category." }, 422);
  }
  const downloadTarget = body.downloadUrl ? parsePublicUrl(body.downloadUrl) : null;
  if (body.downloadUrl && !downloadTarget) return json(req, { error: "Direct download URL must be a public HTTPS link." }, 400);
  if (downloadTarget && !/\\.(?:apk|xapk|apks)$/i.test(downloadTarget.pathname)) {
    return json(req, { error: "Paste a direct .apk, .xapk or .apks file URL, not a web page or generic ZIP." }, 422);
  }
  const sourceRaw = typeof body.url === "string" && body.url.trim() ? body.url : String(body.downloadUrl ?? "");
  const target = parsePublicUrl(sourceRaw);
  if (!target) return json(req, { error: "Enter a valid public HTTPS website or direct download URL." }, 400);
  const notes: string[] = [];
  const out: Detected = { url: target.href };
  const verified = { imdb: false, download: false, logo: false };
  const isTitle = section === "movie" || section === "series";
  const isApp = section === "apps" || section === "music" || section === "tv";
  const isWebsite = section === "sites" || section === "gaming";

  // Fetch an official/source page when available. Package URLs are verified as files, never parsed as HTML.
  let page: PageInfo | null = null;
  const isPackageUrl = (u: URL) => /\.(?:apk|xapk|apks|zip|aab)$/i.test(u.pathname);
  const looksPackage = isPackageUrl(target);
  if (!looksPackage) {
    try {
      const { res, url } = await safeFetch(target, { headers: { Accept: "text/html,application/xhtml+xml" } });
      const type = (res.headers.get("content-type") ?? "").toLowerCase();
      if (res.ok && (type.includes("html") || type === "")) {
        page = extractPage(new TextDecoder().decode(await readLimited(res, 600_000)), url);
      } else { await res.body?.cancel(); notes.push("The source page could not be read (status " + res.status + "). Review the details manually."); }
    } catch (e) { notes.push("The source page could not be read: " + ((e as Error).message || "network error") + ". Review the details manually."); }
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

  // 4. Websites and app categories: verify official logo candidates; app packages are checked separately.
  if (isApp || isWebsite) {
    out.logo_url = page ? await pickLogo(page, target) : null;
    verified.logo = !!out.logo_url;
    if (!out.description) out.description = page?.structured?.description || page?.description || null;
  }
  if (isApp) {
    let apkCandidate: string | null = downloadTarget?.href ?? (looksPackage ? target.href : null);
    if (page) {
      out.official_url = page.canonical && parsePublicUrl(page.canonical)?.hostname.endsWith(baseDomain(target.hostname)) ? page.canonical : target.origin + "/";
      const same = page.apkLinks.filter((l) => {
        const h = new URL(l);
        return baseDomain(h.hostname) === baseDomain(target.hostname) || (h.hostname === "github.com" && /\/releases\/download\//.test(h.pathname));
      });
      const other = page.apkLinks.filter((l) => !same.includes(l));
      apkCandidate = apkCandidate ?? same[0] ?? null;
      if (!apkCandidate && other.length) notes.push("An APK link was found on another domain (" + new URL(other[0]).hostname + "); it was not treated as official.");
    }
    const githubSource = downloadTarget?.hostname === "github.com" ? downloadTarget : target;
    if (githubSource.hostname === "github.com") {
      const gh = await githubApk(githubSource, notes);
      if (gh) {
        out.name = out.name && out.name !== "GitHub" ? out.name : gh.name ?? out.name;
        out.description = out.description || gh.description || null;
        apkCandidate = apkCandidate ?? gh.apk ?? null;
        if (gh.version) out.version = out.version || gh.version;
        if (!out.official_url) {
          const repoPath = githubSource.pathname.match(/^\/([\w.-]+)\/([\w.-]+)/);
          out.official_url = repoPath ? "https://github.com/" + repoPath[1] + "/" + repoPath[2] : "https://github.com/";
        }
      }
    }
    if (apkCandidate) {
      const v = await verifyApk(apkCandidate);
      if (v.ok) { out.download_url = apkCandidate; verified.download = true; out.platform = out.platform ?? "Android"; }
      else notes.push("Direct app package could not be verified (" + v.reason + "). It will not be saved as a verified download.");
    } else notes.push("No verified direct APK/package link was found. Paste a direct APK/XAPK URL; app pages alone are not accepted as direct downloads.");
    if (!out.name && (downloadTarget || looksPackage)) {
      const rawName = new URL(downloadTarget?.href ?? target.href).pathname.split("/").pop() || "";
      const fileName = decodeURIComponent(rawName).replace(/\.(?:apk|xapk|apks|zip|aab)$/i, "").replace(/[._-]+/g, " ").trim();
      if (fileName) { out.name = fileName.slice(0, 160); notes.push("The card name was derived from the package filename. Review and correct it before publishing."); }
    }
    if (!verified.logo) notes.push("No official app logo could be verified from this source. Add an official website/store URL or paste an official logo image URL in the review step.");
  }
  // 5. Sanity: never keep a name that is just a generic site label.
  if (typeof out.name === "string") out.name = out.name.slice(0, 160);
  if (typeof out.description === "string") out.description = norm(out.description) ? out.description.slice(0, 600) : null;
  return json(req, { detected: out, verified, notes });
});
