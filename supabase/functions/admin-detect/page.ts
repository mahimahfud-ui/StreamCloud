// Metadata extraction for websites, apps, and title pages (no third-party parser required).
export type StructuredInfo = {
  name: string | null;
  description: string | null;
  image: string | null;
  year: number | null;
  genres: string[];
  platform: string | null;
  version: string | null;
};
export type PageInfo = {
  html: string;
  title: string | null;
  siteName: string | null;
  description: string | null;
  canonical: string | null;
  icons: string[];
  images: string[];
  imdbIds: string[];
  apkLinks: string[];
  text: string;
  jsonLd: string[];
  structured: StructuredInfo;
};

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decode(m[1] ?? m[2] ?? m[3] ?? "") : null;
};
function abs(href: string | null, base: URL): string | null {
  if (!href) return null;
  try { const u = new URL(href, base); return u.protocol === "https:" ? u.href : null; } catch { return null; }
}
const textVal = (v: unknown): string | null => typeof v === "string" && v.trim() ? decode(v).replace(/\\s+/g, " ").trim().slice(0, 1000) : null;

export function extractPage(html: string, base: URL): PageInfo {
  const metas = [...html.matchAll(/<meta\\b[^>]*>/gi)].map((m) => m[0]);
  const meta = (key: string) => {
    for (const t of metas) {
      const k = (attr(t, "property") ?? attr(t, "name") ?? "").toLowerCase();
      if (k === key.toLowerCase()) { const c = attr(t, "content"); if (c) return c.trim(); }
    }
    return null;
  };

  const rawTitle = decode(html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)?.[1] ?? "").replace(/\\s+/g, " ").trim() || null;
  const title = textVal(meta("og:title") ?? meta("twitter:title") ?? rawTitle);
  const description = textVal(meta("og:description") ?? meta("twitter:description") ?? meta("description"));
  const siteName = textVal(meta("og:site_name") ?? meta("application-name"));

  const links = [...html.matchAll(/<link\\b[^>]*>/gi)].map((m) => m[0]);
  const icons: { href: string; size: number }[] = [];
  const linkImages: string[] = [];
  let canonical: string | null = null;
  for (const t of links) {
    const rel = (attr(t, "rel") ?? "").toLowerCase();
    const href = abs(attr(t, "href"), base);
    if (!href) continue;
    if (rel.includes("canonical")) canonical = href;
    if (rel.includes("image_src")) linkImages.push(href);
    if (/(^|\\s)(apple-touch-icon|icon|shortcut icon)(\\s|$)/.test(rel)) {
      const s = (attr(t, "sizes") ?? "").match(/(\\d+)x\\d+/);
      icons.push({ href, size: s ? Number(s[1]) : rel.includes("apple") ? 180 : 16 });
    }
  }
  icons.sort((a, b) => b.size - a.size);

  const hrefs = [...html.matchAll(/<a\\b[^>]*>/gi)].map((m) => abs(attr(m[0], "href"), base)).filter((v): v is string => !!v);
  const imdbIds = [...new Set([...hrefs, ...[...html.matchAll(/imdb\\.com\\/title\\/(tt\\d{5,10})/gi)].map((m) => "https://imdb.com/title/" + m[1])]
    .map((h) => h.match(/imdb\\.com\\/title\\/(tt\\d{5,10})/i)?.[1]).filter((v): v is string => !!v))];
  const apkLinks = [...new Set(hrefs.filter((h) => { try { return /\\.apk$/i.test(new URL(h).pathname); } catch { return false; } }))];

  const jsonLdFull = [...html.matchAll(/<script[^>]*application\\/ld\\+json[^>]*>([\\s\\S]*?)<\\/script>/gi)].map((m) => m[1].trim()).slice(0, 6);
  const jsonLd = jsonLdFull.map((s) => s.slice(0, 3000)).slice(0, 3);
  const nodes: Record<string, unknown>[] = [];
  const addNodes = (value: unknown, depth = 0) => {
    if (depth > 8 || nodes.length >= 100 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) { for (const v of value) addNodes(v, depth + 1); return; }
    const obj = value as Record<string, unknown>;
    nodes.push(obj);
    for (const [k, v] of Object.entries(obj)) {
      if (k === "@graph" || k === "mainEntity" || k === "mainEntityOfPage" || k === "itemListElement" || k === "subjectOf" || k === "about") addNodes(v, depth + 1);
    }
  };
  for (const raw of jsonLdFull) { try { addNodes(JSON.parse(raw)); } catch { /* Some pages ship invalid or oversized JSON-LD; regular meta tags still work. */ } }

  const typeOf = (o: Record<string, unknown>) => {
    const t = o["@type"];
    return (Array.isArray(t) ? t : [t]).filter((x) => typeof x === "string").join(" ").toLowerCase();
  };
  const primary = nodes.filter((o) => /movie|tvseries|tvepisode|creativework|softwareapplication|mobileapplication|product|webpage|website/.test(typeOf(o)));
  const orderedNodes = [...primary, ...nodes.filter((o) => !primary.includes(o))];
  const getImageUrls = (v: unknown): string[] => {
    if (typeof v === "string") { const u = abs(v, base); return u ? [u] : []; }
    if (Array.isArray(v)) return v.flatMap(getImageUrls);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return [o.url, o.contentUrl, o["@id"]].flatMap((x) => typeof x === "string" ? getImageUrls(x) : []);
    }
    return [];
  };
  const jsonImages = orderedNodes.flatMap((o) => [o.image, o.thumbnailUrl, o.thumbnail, o.primaryImageOfPage].flatMap(getImageUrls));
  const metaImages = metas.flatMap((t) => {
    const k = (attr(t, "property") ?? attr(t, "name") ?? "").toLowerCase();
    if (!["og:image", "og:image:secure_url", "twitter:image", "twitter:image:src", "thumbnail"].includes(k)) return [];
    return getImageUrls(attr(t, "content"));
  });
  const imgSources = [...html.matchAll(/<img\\b[^>]*>/gi)].slice(0, 60).flatMap((m) => {
    const t = m[0];
    const raw = attr(t, "data-src") ?? attr(t, "data-lazy-src") ?? attr(t, "data-original") ?? attr(t, "src") ??
      (attr(t, "srcset") ?? "").split(",")[0].trim().split(/\\s+/)[0] ?? null;
    const value = abs(raw, base);
    return value ? [value] : [];
  });
  const images = [...new Set([...metaImages, ...jsonImages, ...linkImages, ...imgSources])].slice(0, 30);

  for (const o of orderedNodes) {
    const sameAs = [o.url, o.sameAs, o.identifier].flatMap((v) => Array.isArray(v) ? v : [v]).filter((v): v is string => typeof v === "string");
    for (const value of sameAs) {
      const m = value.match(/imdb\\.com\\/title\\/(tt\\d{5,10})/i);
      if (m && !imdbIds.includes(m[1])) imdbIds.push(m[1]);
    }
  }

  const bestNode = orderedNodes.find((o) => textVal(o.name) || textVal(o.headline) || textVal(o.alternateName));
  const date = bestNode ? textVal(bestNode.datePublished ?? bestNode.dateCreated ?? bestNode.uploadDate ?? bestNode.releaseDate) : null;
  const yearMatch = date?.match(/(?:18|19|20|21)\\d{2}/);
  const genreRaw = bestNode?.genre;
  const genres = (Array.isArray(genreRaw) ? genreRaw : genreRaw ? [genreRaw] : [])
    .map((v) => textVal(v)).filter((v): v is string => !!v).slice(0, 12);
  const appCategory = bestNode ? textVal(bestNode.applicationCategory ?? bestNode.applicationSubCategory) : null;
  const structured = {
    name: bestNode ? textVal(bestNode.name ?? bestNode.headline ?? bestNode.alternateName) : null,
    description: bestNode ? textVal(bestNode.description ?? bestNode.abstract) : null,
    image: jsonImages[0] ?? null,
    year: yearMatch ? Number(yearMatch[0]) : null,
    genres,
    platform: bestNode ? textVal(bestNode.operatingSystem ?? appCategory) : null,
    version: bestNode ? textVal(bestNode.softwareVersion) : null,
  };

  const text = decode(html.replace(/<(script|style|noscript|svg)[\\s\\S]*?<\\/\\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\\s+/g, " ").trim().slice(0, 6000);

  return {
    html, title, siteName, description, canonical,
    icons: [...new Set(icons.map((i) => i.href))], images, imdbIds, apkLinks, text, jsonLd, structured,
  };
}
