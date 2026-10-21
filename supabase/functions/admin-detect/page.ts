// Minimal, dependency-free HTML metadata extraction.
export type PageInfo = {
  html: string; title: string | null; siteName: string | null; description: string | null; canonical: string | null;
  icons: string[]; imdbIds: string[]; apkLinks: string[]; text: string; jsonLd: string[];
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

export function extractPage(html: string, base: URL): PageInfo {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const meta = (key: string) => {
    for (const t of metas) {
      const k = (attr(t, "property") ?? attr(t, "name") ?? "").toLowerCase();
      if (k === key) { const c = attr(t, "content"); if (c) return c.trim(); }
    }
    return null;
  };
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim() || null;

  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const icons: { href: string; size: number }[] = [];
  let canonical: string | null = null;
  for (const t of links) {
    const rel = (attr(t, "rel") ?? "").toLowerCase();
    const href = abs(attr(t, "href"), base);
    if (!href) continue;
    if (rel.includes("canonical")) canonical = href;
    if (/(^|\s)(apple-touch-icon|icon|shortcut icon)(\s|$)/.test(rel)) {
      const s = (attr(t, "sizes") ?? "").match(/(\d+)x\d+/);
      icons.push({ href, size: s ? Number(s[1]) : rel.includes("apple") ? 180 : 16 });
    }
  }
  icons.sort((a, b) => b.size - a.size);

  const hrefs = [...html.matchAll(/<a\b[^>]*>/gi)].map((m) => abs(attr(m[0], "href"), base)).filter((v): v is string => !!v);
  const imdbIds = [...new Set([...hrefs, ...[...html.matchAll(/imdb\.com\/title\/(tt\d{5,10})/gi)].map((m) => "https://imdb.com/title/" + m[1])]
    .map((h) => h.match(/imdb\.com\/title\/(tt\d{5,10})/i)?.[1]).filter((v): v is string => !!v))];
  const apkLinks = [...new Set(hrefs.filter((h) => { try { return /\.apk$/i.test(new URL(h).pathname); } catch { return false; } }))];

  const jsonLd = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim().slice(0, 3000)).slice(0, 3);
  const text = decode(html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 6000);

  return {
    html, title, siteName: meta("og:site_name"), description: meta("og:description") ?? meta("description"),
    canonical, icons: [...new Set(icons.map((i) => i.href))], imdbIds, apkLinks, text, jsonLd,
  };
}
