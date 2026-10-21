import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const indexPath = path.join(root, "index.html");
const manifestPath = path.join(root, "logo-manifest.js");
const timeoutMs = 6500;
const maxImageBytes = 2 * 1024 * 1024;
const html = await fs.readFile(indexPath, "utf8");
await fs.mkdir(path.join(root, "assets", "logos"), { recursive: true });

let oldManifestText = "";
try { oldManifestText = await fs.readFile(manifestPath, "utf8"); } catch {}
const legacyMatch = oldManifestText.match(/window\.MAHIFLIX_LOGOS\s*=\s*(\{[\s\S]*?\});/);
const legacySource = legacyMatch ? legacyMatch[0] : "window.MAHIFLIX_LOGOS = {};";
const currentMatch = oldManifestText.match(/window\.STREAMCLOUD_ITEM_LOGOS\s*=\s*(\{[\s\S]*?\});/);
let cachedMap = {};
if (currentMatch) {
  try { cachedMap = JSON.parse(currentMatch[1]); } catch { cachedMap = {}; }
}

function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}
function attribute(tag, name) {
  const rx = new RegExp("\\b" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i");
  const match = tag.match(rx);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "").replace(/&amp;/gi, "&").trim() : "";
}
function absolutePublicUrl(raw, base) {
  try {
    const url = new URL(raw, base);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return "";
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase())) return "";
    return url.href;
  } catch { return ""; }
}
function urlsInArray(text) {
  return [...text.matchAll(/"((?:\\.|[^"\\])*)"/g)].map(match => {
    try { return JSON.parse('"' + match[1] + '"'); } catch { return match[1]; }
  }).filter(Boolean);
}
function extractEntries(arrayName, kind) {
  const start = html.indexOf("const " + arrayName + "=[");
  if (start < 0) return [];
  const end = html.indexOf("\n];", start);
  if (end < 0) return [];
  const section = html.slice(start, end + 3);
  const result = [];
  const objectRe = /\{([\s\S]*?)\}/g;
  let match;
  while ((match = objectRe.exec(section))) {
    const block = match[0];
    const name = (block.match(/\bname:"([^"]+)"/) || [])[1] || "";
    const domain = (block.match(/domain:"([^"]+)"/) || [])[1] || "";
    const pageUrl = (block.match(/url:"([^"]+)"/) || [])[1] || "";
    const logoMatch = block.match(/logoSources:\[([\s\S]*?)\]/);
    const logoUrls = logoMatch ? urlsInArray(logoMatch[1]) : [];
    if (!name || !pageUrl) continue;
    result.push({ name, domain, pageUrl, kind, key: kind + ":" + slug(name), logoUrls });
  }
  return result;
}

const entries = [
  ...extractEntries("S", "site"),
  ...extractEntries("A", "movie"),
  ...extractEntries("M", "music")
];
const uniqueEntries = [...new Map(entries.map(item => [item.key, item])).values()];
if (!uniqueEntries.length) throw new Error("No StreamCloud catalog entries were found in index.html.");

async function fetchResponse(rawUrl, accept) {
  const url = absolutePublicUrl(rawUrl);
  if (!url) throw new Error("Not a public HTTPS URL");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "StreamCloud-Logo-Cache/1.0 (+https://github.com/mahimahfud-ui/StreamCloud)",
        "accept": accept || "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      }
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    if (!absolutePublicUrl(response.url)) throw new Error("Redirect did not remain on HTTPS");
    return response;
  } finally {
    clearTimeout(timer);
  }
}
async function getPageLogoCandidates(item) {
  const url = absolutePublicUrl(item.pageUrl);
  if (!url) return { brand: [], icons: [] };
  const pageUrl = new URL(url);
  if (/\.(?:apk|xapk|aab|zip|exe|msi|dmg)(?:$|[?#])/i.test(pageUrl.pathname)) return { brand: [], icons: [] };
  if (item.kind === "music" && /apkpure|softonic/i.test(pageUrl.hostname) &&
      /\/(?:b\/XAPK|download\/.*post-download)/i.test(pageUrl.pathname)) return { brand: [], icons: [] };
  try {
    const response = await fetchResponse(url, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.2");
    const type = (response.headers.get("content-type") || "").toLowerCase();
    if (!type.includes("html") && !type.includes("xhtml")) return { brand: [], icons: [] };
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 1800000) { await response.body?.cancel(); return { brand: [], icons: [] }; }
    const text = await response.text();
    if (text.length > 1800000) return { brand: [], icons: [] };
    const finalUrl = response.url || url;
    const brand = [], icons = [];
    for (const tag of text.match(/<link\b[^>]*>/gi) || []) {
      const rel = attribute(tag, "rel").toLowerCase();
      const href = attribute(tag, "href");
      if (!href) continue;
      const target = absolutePublicUrl(href, finalUrl);
      if (!target) continue;
      if (/apple-touch-icon|icon|mask-icon|shortcut icon/.test(rel)) icons.push(target);
    }
    for (const tag of text.match(/<img\b[^>]*>/gi) || []) {
      const marker = [
        attribute(tag, "alt"), attribute(tag, "class"),
        attribute(tag, "id"), attribute(tag, "title")
      ].join(" ");
      if (!/(logo|brand|app.?icon|site.?icon)/i.test(marker)) continue;
      const srcset = attribute(tag, "srcset").split(",")[0].trim().split(/\s+/)[0];
      const raw = attribute(tag, "src") || attribute(tag, "data-src") || srcset;
      if (!raw) continue;
      const target = absolutePublicUrl(raw, finalUrl);
      if (target) brand.push(target);
    }
    for (const meta of text.match(/<meta\b[^>]*>/gi) || []) {
      if (attribute(meta, "itemprop").toLowerCase() !== "logo") continue;
      const target = absolutePublicUrl(attribute(meta, "content"), finalUrl);
      if (target) brand.push(target);
    }
    return { brand: [...new Set(brand)], icons: [...new Set(icons)] };
  } catch (error) {
    console.warn("[logo] page inspection failed for " + item.name + ": " + error.message);
    return { brand: [], icons: [] };
  }
}
function sniffImage(buffer, contentType) {
  const type = String(contentType || "").split(";")[0].toLowerCase();
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString("ascii"))) return "gif";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buffer.length >= 6 && buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 1 && buffer[3] === 0) return "ico";
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp" && /avif|avis/.test(buffer.toString("ascii", 8, 16))) return "avif";
  const text = buffer.subarray(0, Math.min(buffer.length, 12000)).toString("utf8");
  if ((type.includes("svg") || /^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text)) && /<svg[\s>]/i.test(text)) {
    if (/<script\b|<foreignObject\b|javascript:|on[a-z]+\s*=|@import|url\(\s*["']?https?:|(?:href|xlink:href)\s*=\s*["']https?:/i.test(text)) {
      throw new Error("SVG logo failed safety checks");
    }
    return "svg";
  }
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("gif")) return "gif";
  if (type.includes("webp")) return "webp";
  if (type.includes("avif")) return "avif";
  if (type.includes("icon")) return "ico";
  if (type.includes("bmp")) return "bmp";
  return "";
}
async function fetchImage(url) {
  const response = await fetchResponse(url);
  const type = response.headers.get("content-type") || "";
  const size = Number(response.headers.get("content-length") || 0);
  if (size > maxImageBytes) throw new Error("Image exceeds 2 MiB");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > maxImageBytes) throw new Error("Invalid logo size");
  const ext = sniffImage(buffer, type);
  if (!ext) throw new Error("URL did not return a valid image");
  return { buffer, ext, finalUrl: response.url || url };
}
function defaultFavicons(pageUrl, domain) {
  let base = "";
  try { base = new URL(pageUrl).origin; } catch {}
  if (!base) {
    const safeDomain = String(domain || "").replace(/[^a-z0-9.-]/gi, "");
    if (safeDomain) base = "https://" + safeDomain;
  }
  if (!base) return [];
  return [base + "/favicon.ico", base + "/favicon.svg", base + "/favicon.png",
    base + "/favicon-32x32.png", base + "/favicon-192x192.png", base + "/apple-touch-icon.png"];
}
async function processEntry(item) {
  const savedPath = cachedMap[item.key];
  if (savedPath) {
    try {
      await fs.access(path.join(root, savedPath.replace(/^\.\//, "")));
      console.log("[logo] already local " + item.name + " -> " + savedPath);
      return { item, savedPath, reused: true };
    } catch { delete cachedMap[item.key]; }
  }
  const discovered = await getPageLogoCandidates(item);
  const specific = item.logoUrls.map(url => absolutePublicUrl(url)).filter(Boolean);
  const candidates = item.kind === "site"
    ? [...discovered.brand, ...discovered.icons, ...specific, ...defaultFavicons(item.pageUrl, item.domain)]
    : [...specific, ...discovered.brand, ...discovered.icons, ...defaultFavicons(item.pageUrl, item.domain)];
  for (const url of [...new Set(candidates)]) {
    try {
      const result = await fetchImage(url);
      const folder = item.kind === "site" ? "sites" : item.kind === "movie" ? "movie-apps" : "music-apps";
      const rel = "assets/logos/" + folder + "/" + slug(item.name) + "." + result.ext;
      const dest = path.join(root, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, result.buffer);
      cachedMap[item.key] = "./" + rel;
      console.log("[logo] saved " + item.name + " -> ./" + rel + " (source " + result.finalUrl + ")");
      return { item, savedPath: "./" + rel, downloaded: true };
    } catch (error) {
      console.warn("[logo] failed " + item.name + " from " + url + ": " + error.message);
    }
  }
  console.warn("[logo] no source succeeded for " + item.name + "; page keeps its fallback chain");
  return { item, failed: true };
}
async function runPool(items, width) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await processEntry(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, worker));
  return results;
}

const outcomes = await runPool(uniqueEntries, 5);
const output = legacySource + "\nwindow.STREAMCLOUD_ITEM_LOGOS = " + JSON.stringify(cachedMap, null, 2) + ";\n";
await fs.writeFile(manifestPath, output, "utf8");
const downloaded = outcomes.filter(result => result.downloaded).length;
const reused = outcomes.filter(result => result.reused).length;
const failed = outcomes.filter(result => result.failed).length;
console.log("[logo] catalog entries: " + uniqueEntries.length + "; downloaded: " + downloaded + "; reused: " + reused + "; failed: " + failed + "; local manifest entries: " + Object.keys(cachedMap).length);
