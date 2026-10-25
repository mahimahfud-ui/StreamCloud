import nodeAssert from "node:assert/strict";
import type { PageInfo } from "../admin-detect/page.ts";
import { askAutoAI } from "../admin-detect/ai-router.ts";
import { askAnthropic } from "../admin-detect/anthropic.ts";
import { askCloudflare } from "../admin-detect/cloudflare.ts";
import { askShannon } from "../admin-detect/shannon.ts";
import { askVenice } from "../admin-detect/venice.ts";
import { parseListingAIResult } from "../admin-detect/structured-ai.ts";

const page: PageInfo = {
  html: "",
  title: "Example App",
  siteName: "Example",
  description: "A sample listing used for unit testing.",
  canonical: "https://example.com/",
  icons: [],
  images: [],
  imdbIds: [],
  apkLinks: [],
  text: "Example listing metadata for testing.",
  jsonLd: [],
  structured: { name: "Example App", description: null, image: null, year: null, genres: [], platform: null, version: null },
};

const expected = {
  name: "Test Listing",
  description: "A useful test description longer than twenty characters.",
  year: 2025,
  genres: ["Drama"],
  platform: null,
  version: null,
  imdbId: "tt1234567",
};
const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const urlOf = (input: RequestInfo | URL) =>
  new URL(input instanceof Request ? input.url : String(input));

Deno.test("listing AI adapters parse provider responses and router falls back after failures", async () => {
  const envNames = [
    "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "VENICE_API_KEY", "VENICEAI_API_KEY", "VENICE", "Venice AI", "VENICE_MODEL",
    "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY", "CLOUDFLARE_ACCOUNT_ID", "Cloudflare Account ID", "Cloudflare", "CLOUDFLARE_MODEL",
    "SHANNON_API_KEY", "SHANNONAI_API_KEY", "SHANNON_AI_API_KEY", "Shannon AI", "SHANNON_MODEL",
    "GROQ_API_KEY", "GROQ_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "GEMINI_API_KEY", "GEMINI_MODEL",
    "DEEPSEEK_API_KEY", "DeepSeek", "DEEPSEEK_MODEL", "OPENAI_API_KEY", "OPENAI_MODEL", "ENABLE_PAID_FALLBACK",
  ];
  const previousEnv = new Map(envNames.map((name) => [name, Deno.env.get(name)]));
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  try {
    for (const name of envNames) Deno.env.delete(name);
    Deno.env.set("ANTHROPIC_API_KEY", "test-anthropic-key");
    Deno.env.set("VENICE_API_KEY", "test-venice-key");
    Deno.env.set("CLOUDFLARE_API_TOKEN", "test-cloudflare-token");
    Deno.env.set("CLOUDFLARE_ACCOUNT_ID", "test-account-id");
    Deno.env.set("SHANNON_API_KEY", "test-shannon-key");

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const host = urlOf(input).hostname;
      calls.push(host);
      if (host === "api.anthropic.com") return jsonResponse({ content: [{ type: "text", text: JSON.stringify(expected) }] });
      if (host === "api.venice.ai") return jsonResponse({ choices: [{ message: { content: JSON.stringify(expected) } }] });
      if (host === "api.cloudflare.com") return jsonResponse({ success: true, result: { response: JSON.stringify(expected) } });
      if (host === "api.shannon-ai.com") return jsonResponse({ choices: [{ message: { content: JSON.stringify(expected) } }] });
      return jsonResponse({ error: { message: "Unexpected test URL" } }, 500);
    };

    nodeAssert.equal((await askAnthropic(page, "sites"))?.name, expected.name);
    nodeAssert.equal((await askVenice(page, "sites"))?.name, expected.name);
    nodeAssert.equal((await askCloudflare(page, "sites"))?.name, expected.name);
    nodeAssert.equal((await askShannon(page, "sites"))?.name, expected.name);
    nodeAssert.deepEqual(parseListingAIResult("\x60\x60\x60json\n" + JSON.stringify(expected) + "\n\x60\x60\x60"), expected);
    nodeAssert.ok(calls.includes("api.anthropic.com"));
    nodeAssert.ok(calls.includes("api.venice.ai"));
    nodeAssert.ok(calls.includes("api.cloudflare.com"));
    nodeAssert.ok(calls.includes("api.shannon-ai.com"));

    // Only the first two providers will reject their credentials. Venice is the next
    // eligible fallback and should still produce a result rather than ending the cascade.
    calls.length = 0;
    Deno.env.delete("ANTHROPIC_API_KEY");
    Deno.env.delete("CLOUDFLARE_API_TOKEN");
    Deno.env.delete("CLOUDFLARE_API_KEY");
    Deno.env.delete("CLOUDFLARE_ACCOUNT_ID");
    Deno.env.delete("Cloudflare Account ID");
    Deno.env.delete("Cloudflare");
    Deno.env.delete("SHANNON_API_KEY");
    Deno.env.delete("SHANNONAI_API_KEY");
    Deno.env.delete("SHANNON_AI_API_KEY");
    Deno.env.delete("Shannon AI");
    Deno.env.set("GROQ_API_KEY", "test-groq-key");
    Deno.env.set("OPENROUTER_API_KEY", "test-openrouter-key");
    Deno.env.set("VENICE_API_KEY", "test-venice-key");
    Deno.env.delete("ENABLE_PAID_FALLBACK");

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const host = urlOf(input).hostname;
      calls.push(host);
      if (host === "api.groq.com" || host === "openrouter.ai") {
        return jsonResponse({ error: { message: "unauthorized" } }, 401);
      }
      if (host === "api.venice.ai") {
        return jsonResponse({ choices: [{ message: { content: JSON.stringify(expected) } }] });
      }
      return jsonResponse({ error: { message: "Unexpected provider called in fallback test" } }, 500);
    };

    const routed = await askAutoAI(page, "sites", "metadata");
    nodeAssert.equal(routed.provider, "venice");
    nodeAssert.equal(routed.result?.name, expected.name);
    nodeAssert.deepEqual(calls.slice(0, 3), ["api.groq.com", "openrouter.ai", "api.venice.ai"]);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of previousEnv) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
});
