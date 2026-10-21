import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const checked = { javascript: 0, inlineScripts: 0, json: 0, localReferences: 0 };

function walk(dir, prefix = "") {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const relative = prefix ? prefix + "/" + entry.name : entry.name;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(absolute, relative));
    else if (entry.isFile()) found.push(relative.replace(/\\/g, "/"));
  }
  return found;
}

const files = walk(ROOT);
const fileSet = new Set(files);
const abs = (relative) => path.join(ROOT, ...relative.split("/"));

function resolveRef(fromFile, reference, label) {
  let raw = String(reference || "").trim();
  if (!raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) return;
  if (raw.includes("${") || raw.includes("{{")) return;
  raw = raw.split(/[?#]/, 1)[0];
  if (!raw) return;
  if (raw.startsWith("/")) {
    errors.push(`${label}: root-absolute path "${reference}" will break on the GitHub Pages project URL; use a relative path.`);
    return;
  }
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { decoded = raw; }
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), decoded));
  if (resolved === ".." || resolved.startsWith("../")) {
    errors.push(`${label}: path escapes repository root: "${reference}".`);
    return;
  }
  checked.localReferences++;
  if (!fileSet.has(resolved) && !fs.existsSync(abs(resolved))) {
    errors.push(`${label}: missing local file "${reference}" (resolved to ${resolved}).`);
  }
}

function checkNodeSyntax(filePath, displayPath) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 8 * 1024 * 1024
  });
  if (result.status !== 0) {
    errors.push(`JavaScript syntax error in ${displayPath}:\n${(result.stderr || result.stdout || "Node parser failed").trim()}`);
  }
}

for (const file of files.filter((p) => /\.(?:js|mjs|cjs)$/i.test(p))) {
  checked.javascript++;
  checkNodeSyntax(abs(file), file);
}

const indexPath = abs("index.html");
if (!fs.existsSync(indexPath)) {
  errors.push("index.html is missing from the repository root.");
} else {
  const html = fs.readFileSync(indexPath, "utf8");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "streamcloud-inline-check-"));
  try {
    let number = 0;
    const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
    for (const match of html.matchAll(scriptPattern)) {
      const attrs = match[1] || "";
      const body = match[2] || "";
      if (/\bsrc\s*=/.test(attrs) || !body.trim()) continue;
      const typeMatch = attrs.match(/\btype\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
      const type = (typeMatch && (typeMatch[1] || typeMatch[2] || typeMatch[3]) || "").toLowerCase();
      if (type && !["module", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"].includes(type)) continue;
      number++;
      const extension = type === "module" ? "mjs" : "cjs";
      const tempFile = path.join(tempDir, `inline-${number}.${extension}`);
      fs.writeFileSync(tempFile, body, "utf8");
      checked.inlineScripts++;
      checkNodeSyntax(tempFile, `index.html inline script #${number}`);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // Check local script, stylesheet, image, manifest and navigation resources in actual HTML tags.
  const markupOnly = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "");
  for (const tagMatch of markupOnly.matchAll(/<[a-z][^>]*>/gi)) {
    const tag = tagMatch[0];
    for (const attrMatch of tag.matchAll(/\b(href|src|poster|data-src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      resolveRef("index.html", attrMatch[2] ?? attrMatch[3] ?? attrMatch[4], "index.html");
    }
    const srcsetMatch = tag.match(/\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (srcsetMatch) {
      for (const candidate of (srcsetMatch[1] || srcsetMatch[2] || "").split(",")) {
        const url = candidate.trim().split(/\s+/)[0];
        if (url) resolveRef("index.html", url, "index.html srcset");
      }
    }
  }
}

// Check explicit local imports and asset URLs in JavaScript modules.
for (const file of files.filter((p) => /\.(?:js|mjs|cjs)$/i.test(p) && !p.startsWith("vendor/"))) {
  const source = fs.readFileSync(abs(file), "utf8");
  for (const match of source.matchAll(/\b(?:from\s*|import\s*)["'](\.{1,2}\/[^"']+)["']/g)) {
    resolveRef(file, match[1], file);
  }
  for (const match of source.matchAll(/new\s+URL\(\s*["'](\.{1,2}\/[^"']+)["']\s*,\s*import\.meta\.url\s*\)/g)) {
    resolveRef(file, match[1], file);
  }
}

// CSS url(...) references must resolve inside the repository when they are local.
for (const file of files.filter((p) => /\.css$/i.test(p))) {
  const source = fs.readFileSync(abs(file), "utf8");
  for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
    const reference = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    resolveRef(file, reference, file);
  }
}

// Validate every cached service-worker shell URL, so missing assets cannot silently ship.
const swPath = abs("sw.js");
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, "utf8");
  const shell = sw.match(/const\s+SHELL_PATHS\s*=\s*\[([\s\S]*?)\]/);
  if (shell) {
    for (const match of shell[1].matchAll(/["']([^"']+)["']/g)) resolveRef("sw.js", match[1], "sw.js SHELL_PATHS");
  }
}

for (const file of files.filter((p) => /\.(?:json|webmanifest)$/i.test(p))) {
  try {
    const value = JSON.parse(fs.readFileSync(abs(file), "utf8"));
    checked.json++;
    if (file === "data/recommendations.json") {
      for (const group of ["movies", "series"]) {
        if (!Array.isArray(value[group])) {
          errors.push(`${file}: "${group}" must be an array.`);
          continue;
        }
        value[group].forEach((item, index) => {
          const label = `${file}: ${group}[${index}]`;
          if (!item || typeof item !== "object" || typeof item.title !== "string" || !item.title.trim()) {
            errors.push(`${label}: title is required.`);
            return;
          }
          if (item.rating != null) {
            const rating = Number(item.rating.value);
            if (!Number.isFinite(rating) || rating < 0 || rating > 10) errors.push(`${label}: rating must be a number from 0 to 10.`);
          }
          if (item.poster && !/^https:\/\//i.test(item.poster) && !/^(?:\.\/|\.\.\/|assets\/|\/)/.test(item.poster)) {
            errors.push(`${label}: poster must be an HTTPS URL or a supported local path.`);
          }
          if (group === "series") {
            for (const key of ["seasonCount", "episodeCount"]) {
              if (item[key] != null && (!Number.isInteger(Number(item[key])) || Number(item[key]) < 1)) {
                errors.push(`${label}: ${key} must be a positive integer when supplied.`);
              }
            }
          }
        });
      }
    }
  } catch (error) {
    errors.push(`Invalid JSON in ${file}: ${error.message}`);
  }
}

if (errors.length) {
  console.error(`StreamCloud validation failed with ${errors.length} issue(s):`);
  errors.forEach((error, index) => console.error(`\n${index + 1}. ${error}`));
  process.exitCode = 1;
} else {
  console.log("StreamCloud validation passed.");
  console.log(`Checked ${checked.javascript} JavaScript files, ${checked.inlineScripts} inline scripts, ${checked.json} JSON files, and ${checked.localReferences} local references.`);
}
