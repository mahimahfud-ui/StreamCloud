import nodeAssert from "node:assert/strict";
import { checkProviderHealth } from "../admin-detect/provider-health.ts";

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

Deno.test("provider health probes credentials without returning secret values or generating AI", async () => {
  const env = {
    GEMINI_API_KEY: "test-gemini-key",
    GROQ_API_KEY: "test-groq-key",
    OPENROUTER_API_KEY: "test-openrouter-key",
    DEEPSEEK_API_KEY: "test-deepseek-key",
    OPENAI_API_KEY: "test-openai-key",
    ANTHROPIC_API_KEY: "test-anthropic-key",
    VENICE_API_KEY: "test-venice-key",
    CLOUDFLARE_API_TOKEN: "test-cloudflare-token",
    CLOUDFLARE_ACCOUNT_ID: "test-account-id",
    SHANNON_API_KEY: "test-shannon-key",
    OMDB_API_KEY: "test-omdb-key",
    ENABLE_PAID_FALLBACK: "true",
  };
  const previous = new Map(Object.keys(env).map((key) => [key, Deno.env.get(key)]));
  const originalFetch = globalThis.fetch;
  const endpoints: string[] = [];
  const keysSeen: string[] = [];
  try {
    for (const [key, value] of Object.entries(env)) Deno.env.set(key, value);
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? new URL(input.url) : new URL(String(input));
      endpoints.push(url.hostname + url.pathname);
      const headers = new Headers(init?.headers);
      for (const [, value] of headers.entries()) {
        if (value.includes("test-") && value.includes("-key") || value.includes("test-cloudflare-token")) keysSeen.push(value);
      }
      if (url.hostname === "generativelanguage.googleapis.com") {
        return jsonResponse({ models: [{ name: "models/gemini-test", supportedGenerationMethods: ["generateContent"] }] });
      }
      if (url.hostname === "api.groq.com") return jsonResponse({ data: [{ id: "test-model" }] });
      if (url.hostname === "openrouter.ai") return jsonResponse({ data: { limit_remaining: 10, disabled: false } });
      if (url.hostname === "api.deepseek.com") return jsonResponse({ is_available: true, balance_infos: [] });
      if (url.hostname === "api.openai.com") return jsonResponse({ data: [{ id: "test-model" }] });
      if (url.hostname === "api.anthropic.com") {
        return jsonResponse({ data: [{ id: "claude-haiku-4-5-20251001" }], has_more: false });
      }
      if (url.hostname === "api.venice.ai") {
        return jsonResponse({ data: { accessPermitted: true, apiTier: { isCharged: false }, rateLimits: [] } });
      }
      if (url.hostname === "api.cloudflare.com" && url.pathname.endsWith("/user/tokens/verify")) {
        return jsonResponse({ success: true, result: { status: "active" } });
      }
      if (url.hostname === "api.cloudflare.com" && url.pathname.includes("/ai/models/search")) {
        return jsonResponse({ success: true, result: [{ id: "@cf/zai-org/glm-4.7-flash" }] });
      }
      if (url.hostname === "api.shannon-ai.com") return jsonResponse({ data: [{ id: "shannon-3" }] });
      if (url.hostname === "www.omdbapi.com") {
        return jsonResponse({ Response: "True", Title: "Inception", Type: "movie", imdbID: "tt1375666" });
      }
      return jsonResponse({ error: "unexpected endpoint" }, 500);
    };

    const result = await checkProviderHealth({ includeOmdb: true });
    nodeAssert.equal(result.paidFallbackEnabled, true);
    nodeAssert.equal(result.providers.length, 10);
    nodeAssert.ok(result.providers.every((p) => p.status === "ready"), JSON.stringify(result.providers));
    nodeAssert.ok(endpoints.includes("api.cloudflare.com/client/v4/user/tokens/verify"));
    nodeAssert.ok(endpoints.includes("api.cloudflare.com/client/v4/accounts/test-account-id/ai/models/search"));
    nodeAssert.ok(endpoints.includes("www.omdbapi.com/"));
    const exposed = JSON.stringify(result);
    for (const value of Object.values(env)) {
      if (value.startsWith("test-")) nodeAssert.equal(exposed.includes(value), false, "health output must not expose credentials");
    }
    nodeAssert.equal(endpoints.some((endpoint) => endpoint.includes("/chat/completions")), false);
    nodeAssert.equal(endpoints.some((endpoint) => endpoint.includes("/ai/run/")), false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of previous) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
});

Deno.test("provider health reports missing credentials without making network calls", async () => {
  const keys = [
    "GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "DeepSeek",
    "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "VENICE_API_KEY", "VENICEAI_API_KEY", "VENICE", "Venice AI",
    "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY", "Cloudflare", "CLOUDFLARE_ACCOUNT_ID", "Cloudflare Account ID",
    "SHANNON_API_KEY", "SHANNONAI_API_KEY", "SHANNON_AI_API_KEY", "Shannon AI", "OMDB_API_KEY",
  ];
  const previous = new Map(keys.map((key) => [key, Deno.env.get(key)]));
  const originalFetch = globalThis.fetch;
  try {
    for (const key of keys) Deno.env.delete(key);
    globalThis.fetch = async () => { throw new Error("The health checker should not make a request for missing keys."); };
    const result = await checkProviderHealth({ includeOmdb: true });
    nodeAssert.ok(result.providers.every((provider) => provider.status === "missing_secret"));
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of previous) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
});
