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
