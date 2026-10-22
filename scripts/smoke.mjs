import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const PORT = 4317;
const ORIGIN = `http://${HOST}:${PORT}`;
const server = spawn(process.execPath, [path.join(ROOT, "scripts/serve.mjs")], {
  cwd: ROOT,
  env: { ...process.env, HOST, PORT: String(PORT) },
  stdio: "ignore",
});
let browser;
const failures = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(ORIGIN);
      if (response.ok) return;
    } catch {}
    await pause(200);
  }
  throw new Error("Local server did not become ready.");
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const mockToken = "a".repeat(64);
  const mockListingId = "11111111-1111-4111-8111-111111111111";
  const mockState = {
    settings: {
      schemaVersion: 1, site: {}, appearance: {},
      sections: {
        sites: { visible: true, title: "Movie Websites" },
        apps: { visible: true, title: "Movie Apps" },
        music: { visible: true, title: "Music Apps" },
        recs: { visible: true, title: "Recommendations" },
        order: ["sites", "apps", "music", "recs"]
      },
      content: { overrides: {}, hidden: [], order: {} }
    },
    listings: [{
      id: mockListingId, section: "sites", category: "General", name: "Smoke test listing",
      url: "https://example.com/", url_key: "example.com/", description: "Mock listing for browser tests",
      published: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), position: 0, ads: 1
    }],
    activity: [],
    calls: []
  };
  await context.route("https://husydmiujigyonlxbuuj.supabase.co/**", async (route) => {
    const req = route.request();
    const reqUrl = new URL(req.url());
    const requestHeaders = req.headers();
    const origin = requestHeaders.origin || ORIGIN;
    const cors = {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "content-type, x-admin-token, apikey, authorization",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-max-age": "600",
      "vary": "Origin",
      "content-type": "application/json",
    };
    const reply = (body, status = 200) => route.fulfill({
      status, headers: cors, body: JSON.stringify(body)
    });
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors, body: "" });
      return;
    }
    if (reqUrl.pathname.startsWith("/rest/v1/site_settings")) {
      await reply([{ settings: mockState.settings, updated_at: new Date().toISOString() }]);
      return;
    }
    if (reqUrl.pathname.startsWith("/rest/v1/listings")) {
      await reply([]);
      return;
    }
    if (reqUrl.pathname === "/functions/v1/admin-login") {
      const body = req.postDataJSON();
      if (body.pin !== "smoke-pin") { await reply({ error: "Wrong PIN." }, 401); return; }
      await reply({ ok: true, token: mockToken, expiresAt: Date.now() + 8 * 60 * 60 * 1000, ttl: 8 * 60 * 60 });
      return;
    }
    if (reqUrl.pathname === "/functions/v1/admin-listings") {
      const body = req.postDataJSON();
      mockState.calls.push(body);
      if (body.action !== "logout" && requestHeaders["x-admin-token"] !== mockToken) {
        await reply({ error: "Admin session expired." }, 401);
        return;
      }
      if (body.action === "overview") {
        await reply({
          counts: { all: mockState.listings.length, published: mockState.listings.filter((x) => x.published).length, hidden: mockState.listings.filter((x) => !x.published).length, sites: 1, apps: 0, music: 0, movie: 0, series: 0 },
          activity: mockState.activity, settings: mockState.settings, settingsUpdatedAt: null
        });
        return;
      }
      if (body.action === "list") { await reply({ listings: mockState.listings }); return; }
      if (body.action === "settings-get") { await reply({ settings: mockState.settings, updatedAt: null }); return; }
      if (body.action === "settings-save") { mockState.settings = body.settings; await reply({ ok: true, settings: mockState.settings }); return; }
      if (body.action === "activity-list") { await reply({ activity: mockState.activity }); return; }
      if (body.action === "bulk") {
        const ids = body.ids || [];
        if (body.operation === "delete") mockState.listings = mockState.listings.filter((x) => !ids.includes(x.id));
        if (body.operation === "hide" || body.operation === "publish") mockState.listings.forEach((x) => { if (ids.includes(x.id)) x.published = body.operation === "publish"; });
        if (body.operation === "move") mockState.listings.forEach((x) => { if (ids.includes(x.id)) { x.section = body.section; x.category = body.category; } });
        await reply({ ok: true, affected: ids.length });
        return;
      }
      if (body.action === "delete") { mockState.listings = mockState.listings.filter((x) => x.id !== body.id); await reply({ ok: true }); return; }
      if (body.action === "pin-change") { await reply({ ok: true, reLoginRequired: true }); return; }
      if (body.action === "logout") { await reply({ ok: true }); return; }
      if (body.action === "import") { await reply({ ok: true, added: 0, skipped: 0, errors: [] }); return; }
      await reply({ error: "Unknown mock action." }, 400);
      return;
    }
    await reply({ error: "Unexpected mocked Supabase endpoint." }, 404);
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push("Uncaught page error: " + error.message));
  page.on("response", (response) => {
    try {
      if (new URL(response.url()).origin === ORIGIN && response.status() >= 400) {
        failures.push(`Local HTTP ${response.status()}: ${response.url()}`);
      }
    } catch {}
  });
  page.on("requestfailed", (request) => {
    try {
      if (new URL(request.url()).origin === ORIGIN) failures.push("Failed local request: " + request.url());
    } catch {}
  });

  await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#sitesView .card", { timeout: 15000 });
  assert.ok(await page.locator("#sitesView .card").count() > 0, "Website catalog should render");

  // The admin shortcut should open a PIN gate without changing or blocking the main UI.
  assert.ok(await page.locator("#adminIcon").isVisible(), "Admin icon should render beside the social link");
  await page.locator("#adminIcon").click();
  await page.locator('input[aria-label="Admin PIN"]').waitFor({ timeout: 5000 });
  assert.ok(await page.locator('input[aria-label="Admin PIN"]').isVisible(), "Admin icon should open the PIN gate");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector(".scx-ov")?.hidden === true);

  // The page module injects and wires the Music Apps tab after the original page scripts.
  await page.locator('.mode[data-mode="music"]').waitFor({ timeout: 15000 });
  await page.locator('.mode[data-mode="apps"]').click();
  await page.waitForFunction(() => {
    const el = document.querySelector(".mode[data-mode='apps']");
    return !!el && el.classList.contains("active");
  });
  assert.ok(await page.locator("#appsView .card").count() > 0, "Movie apps should render");

  await page.locator('.mode[data-mode="music"]').click();
  await page.waitForFunction(() => window.STREAMCLOUD_ACTIVE_CATEGORY === "music");
  assert.ok(await page.locator("#appsView .card").count() > 0, "Music apps should render");

  await page.locator('.mode[data-mode="sites"]').click();
  const search = page.locator("#q");
  await search.fill("Movy");
  await page.waitForFunction(() => document.getElementById("acList")?.classList.contains("open"));
  assert.ok(await page.locator("#acList li[role='option']").count() > 0, "Search autocomplete should return a result");
  await page.locator("#acList li[role='option']").first().click();

  await page.locator("#recsGrid .t-card").first().waitFor({ timeout: 15000 });
  await page.locator('.t-tab[data-type="series"]').click();
  assert.ok(await page.locator("#recsGrid .t-card").count() > 0, "Web-series recommendations should render");
  await page.locator("#recsGrid .t-card").first().click();
  await page.waitForFunction(() => document.getElementById("titleModal")?.classList.contains("open"));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("titleModal")?.classList.contains("open"));

  // Verify the watchlist can add and remove an item without leaving test data behind.
  await page.locator(".wl-open").click();
  await page.locator('#wlForm input[name="title"]').fill("StreamCloud automated smoke test");
  await page.locator("#wlSubmit").click();
  assert.ok(await page.locator("#wlList").getByText("StreamCloud automated smoke test").count() > 0, "Watchlist should add an item");
  await page.locator("#wlList li").filter({ hasText: "StreamCloud automated smoke test" }).locator('[data-act="del"]').click();
  await page.locator("#wlList li").filter({ hasText: "StreamCloud automated smoke test" }).locator('[data-act="del"]').click();
  assert.equal(await page.locator("#wlList").getByText("StreamCloud automated smoke test").count(), 0, "Watchlist should delete the test item");

  // Exercise the admin dashboard using a mocked backend so tests never change production data.
  await page.locator("#adminIcon").click();
  await page.locator('input[aria-label="Admin PIN"]').fill("smoke-pin");
  await page.getByRole("button", { name: "Unlock" }).click();
  await page.getByText("Recent admin activity").waitFor({ timeout: 8000 });
  assert.ok(mockState.calls.some((x) => x.action === "overview"), "Admin overview API should be called after PIN login");

  await page.getByRole("button", { name: "Content" }).click();
  await page.getByText("Smoke test listing").waitFor({ timeout: 8000 });
  await page.locator('input[data-listing-id="' + mockListingId + '"]').check();
  await page.getByRole("button", { name: "Hide", exact: true }).first().click();
  await page.getByText("Bulk action saved.").waitFor({ timeout: 8000 });
  assert.ok(mockState.calls.some((x) => x.action === "bulk" && x.operation === "hide" && x.ids.includes(mockListingId)), "Bulk hide should use the protected admin API");
  assert.equal(mockState.listings[0].published, false, "Bulk hide should persist the visibility change");

  await page.getByRole("button", { name: "Cards & Layout" }).click();
  await page.getByText("Edit and arrange cards").waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: "Save section and grid settings" }).waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.locator('.scx-in[type="color"]').first().waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: "Site settings" }).click();
  await page.getByRole("button", { name: "Save site settings" }).waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: "Log out" }).click();
  await page.locator('input[aria-label="Admin PIN"]').waitFor({ timeout: 8000 });
  assert.ok(mockState.calls.some((x) => x.action === "logout"), "Admin logout should revoke the current session");

  await context.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  mobile.on("pageerror", (error) => failures.push("Mobile uncaught page error: " + error.message));
  await mobile.goto(ORIGIN, { waitUntil: "domcontentloaded" });
  await mobile.waitForSelector("#sitesView .card", { timeout: 15000 });
  const dimensions = await mobile.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  assert.ok(dimensions.content <= dimensions.viewport + 1, `Mobile layout overflows horizontally: ${JSON.stringify(dimensions)}`);
  await mobile.close();

  if (failures.length) throw new Error(failures.join("\n"));
  console.log("StreamCloud browser smoke test passed: website/movie-app/music-app tabs, search autocomplete, recommendations/modal, watchlist CRUD, mobile width, and local requests.");
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill("SIGTERM");
}
