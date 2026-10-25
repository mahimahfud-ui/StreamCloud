// Run: cd supabase/functions && deno test --allow-env tests  (copy outside a folder that has package.json)
import nodeAssert from "node:assert/strict";
const assert = (v: unknown, msg?: string) => nodeAssert.ok(v, msg);
const assertFalse = (v: unknown, msg?: string) => nodeAssert.ok(!v, msg);
const assertEquals = (a: unknown, b: unknown) => nodeAssert.deepEqual(a, b);
import { isPrivateIp, normalizeUrlKey, parsePublicUrl } from "../_shared/urls.ts";
import { validateListing } from "../_shared/listing.ts";
import { getSessionToken, issueToken, sha256Hex } from "../_shared/auth.ts";
import { extractPage } from "../admin-detect/page.ts";
import { omdbLookup } from "../admin-detect/omdb.ts";


Deno.test("parsePublicUrl accepts public https and blocks unsafe targets", () => {
  assert(parsePublicUrl("https://example.com/a"));
  for (const bad of ["http://example.com", "https://localhost/", "https://127.0.0.1/", "https://[::1]/", "https://10.0.0.1/",
    "https://user:pw@example.com/", "https://example.com:8443/", "javascript:alert(1)", "https://foo.internal/", "ftp://example.com", "https://2130706433/"]) {
    assertFalse(parsePublicUrl(bad), bad);
  }
});

Deno.test("isPrivateIp", () => {
  for (const ip of ["10.1.1.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) assert(isPrivateIp(ip), ip);
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1"]) assertFalse(isPrivateIp(ip), ip);
});

Deno.test("normalizeUrlKey makes duplicates match", () => {
  const a = normalizeUrlKey("https://www.Example.com/app/?utm_source=x&b=2&a=1#frag");
  assertEquals(a, normalizeUrlKey("https://example.com/app?a=1&b=2"));
});

Deno.test("validateListing rejects bad input and builds a safe row", () => {
  assert(validateListing({ section: "sites", category: "Movie Website", name: "X", url: "javascript:alert(1)" }).errors?.url);
  assert(validateListing({ section: "nope", category: "A", name: "X", url: "https://x.com" }).errors?.section);
  assert(validateListing({ section: "sites", category: "A", name: "X", url: "https://x.com", logo_url: "http://x.com/l.png" }).errors?.logo_url);
  assert(validateListing({ section: "movie", category: "Movie", name: "X", url: "https://x.com", imdb_rating: 11 }).errors?.imdb_rating);
  const ok = validateListing({ section: "series", category: "Web Series", name: " Show ", url: "https://x.com/s/", imdb_id: "https://www.imdb.com/title/tt0944947/", imdb_rating: 9.24, season_count: 8, genres: ["Drama", ""] });
  assertEquals(ok.errors, undefined);
  assertEquals(ok.row?.imdb_id, "tt0944947");
  assertEquals(ok.row?.imdb_rating, 9.2);
  assertEquals(ok.row?.name, "Show");
  assertEquals(ok.row?.download_verified, false);
  assertEquals(ok.row?.genres, ["Drama"]);
});

Deno.test("admin session token: hash, format, expiry and request header", async () => {
  const { token, tokenHash, expiresAt } = await issueToken();
  assert(/^[a-f0-9]{64}$/.test(token), "session token is 256-bit hex");
  assertEquals(tokenHash, await sha256Hex(token));
  assert(expiresAt > Date.now());
  assert(expiresAt <= Date.now() + 8 * 60 * 1000 * 60 + 1000);

  const validRequest = new Request("https://example.com", { headers: { "x-admin-token": token } });
  assertEquals(getSessionToken(validRequest), token);
  assertEquals(getSessionToken(new Request("https://example.com")), null);
  assertEquals(getSessionToken(new Request("https://example.com", {
    headers: { "x-admin-token": token.slice(0, -1) }
  })), null);
  assertEquals(getSessionToken(new Request("https://example.com", {
    headers: { "x-admin-token": token.toUpperCase() }
  })), null);
});

Deno.test("sha256Hex is deterministic", async () => {
  assertEquals(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

Deno.test("extractPage finds icons, imdb ids and apk links", () => {
  const html = `<html><head><title> My App </title><meta property="og:description" content="A &amp; B">
  <link rel="icon" href="/f.ico"><link rel="apple-touch-icon" sizes="180x180" href="/a.png"></head>
  <body><a href="/dl/app.apk?x=1">dl</a><a href="http://insecure.com/x.apk">no</a><a href="https://www.imdb.com/title/tt0944947/">imdb</a></body></html>`;
  const p = extractPage(html, new URL("https://example.com/"));
  assertEquals(p.title, "My App");
  assertEquals(p.description, "A & B");
  assertEquals(p.icons[0], "https://example.com/a.png");
  assertEquals(p.apkLinks, ["https://example.com/dl/app.apk?x=1"]);
  assertEquals(p.imdbIds, ["tt0944947"]);
});

Deno.test("omdbLookup: no key, exact match only, episode sum", async () => {
  const real = globalThis.fetch;
  try {
    Deno.env.delete("OMDB_API_KEY");
    assertEquals((await omdbLookup({ title: "X", year: null, type: "movie" })).status, "no-key");
    Deno.env.set("OMDB_API_KEY", "এপিয়াই");
    assertEquals((await omdbLookup({ title: "X", year: null, type: "movie" })).status, "no-key");
    Deno.env.set("OMDB_API_KEY", "k");
    globalThis.fetch = (u: string | URL | Request) => {
      const q = new URL(String(u)).searchParams;
      const r = (o: unknown) => Promise.resolve(new Response(JSON.stringify(o)));
      if (q.get("Season")) return r({ Response: "True", Episodes: [{}, {}, {}] });
      if (q.get("t") === "Wrong Title") return r({ Response: "True", Title: "Other Show", Year: "2011", Type: "series", imdbID: "tt1", imdbRating: "8", totalSeasons: "2" });
      return r({ Response: "True", Title: "Game of Thrones", Year: "2011–2019", Type: "series", imdbID: "tt0944947", imdbRating: "9.2", totalSeasons: "2", Genre: "Action, Drama", Poster: "N/A", Plot: "N/A" });
    };
    assertEquals((await omdbLookup({ title: "Wrong Title", year: 2011, type: "series" })).status, "not-found");
    const ok = await omdbLookup({ title: "Game of Thrones", year: 2011, type: "series" });
    assertEquals(ok.status, "ok");
    assertEquals(ok.data?.seasons, 2);
    assertEquals(ok.data?.episodes, 6);
    assertEquals(ok.data?.rating, 9.2);
    assertEquals(ok.data?.poster, null);
    assertEquals((await omdbLookup({ title: "Game of Thrones", year: 2011, type: "movie" })).status, "type-mismatch");
  } finally { globalThis.fetch = real; }
});
