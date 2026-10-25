import { cloudflareCredentials } from "./cloudflare.ts";
import { isPlaceholderKey } from "./structured-ai.ts";

export type ProviderHealthItem = {
  provider: string;
  status: string;
  fallbackEnabled: boolean;
  detail: string;
};

type ProbeResult = { ok: boolean; status: number; data: Record<string, unknown> };

const PAID_OR_USAGE_GATED = new Set(["cloudflare", "venice", "shannon", "anthropic", "deepseek", "openai"]);

function firstSecret(names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  return "";
}

function safeStatus(status: number): string {
  if (status === 401) return "invalid_key";
  if (status === 403) return "permission_denied";
  if (status === 402) return "billing_or_balance_required";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "probe_failed";
}

async function getJson(url: string, headers: Record<string, string>): Promise<ProbeResult> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(8000),
    });
    const parsed = await response.json().catch(() => ({}));
    const data = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

function headerBearer(key: string): Record<string, string> {
  return { Authorization: "Bearer " + key };
}

function errorStatus(result: ProbeResult): string {
  return result.status === 0 ? "network_or_timeout_error" : safeStatus(result.status);
}

function providerResult(provider: string, status: string, detail: string): ProviderHealthItem {
  const fallbackEnabled = !PAID_OR_USAGE_GATED.has(provider) ||
    Deno.env.get("ENABLE_PAID_FALLBACK")?.trim().toLowerCase() === "true";
  return { provider, status, fallbackEnabled, detail };
}

async function probeGemini(): Promise<ProviderHealthItem> {
  const key = firstSecret(["GEMINI_API_KEY"]);
  if (isPlaceholderKey(key)) return providerResult("gemini", "missing_secret", "Add GEMINI_API_KEY in Supabase Edge Function secrets.");
  const response = await getJson("https://generativelanguage.googleapis.com/v1beta/models", { "x-goog-api-key": key });
  if (!response.ok) return providerResult("gemini", errorStatus(response), "Gemini model-list API rejected the request.");
  const models = Array.isArray(response.data.models) ? response.data.models as Array<Record<string, unknown>> : [];
  const usable = models.some((model) => Array.isArray(model.supportedGenerationMethods) &&
    (model.supportedGenerationMethods as unknown[]).includes("generateContent"));
  return providerResult("gemini", usable ? "ready" : "valid_key_no_generation_model", usable
    ? "Credential accepted and at least one generateContent model is available."
    : "Credential accepted, but the API returned no generateContent model.");
}

async function probeGroq(): Promise<ProviderHealthItem> {
  const key = firstSecret(["GROQ_API_KEY"]);
  if (isPlaceholderKey(key)) return providerResult("groq", "missing_secret", "Add GROQ_API_KEY in Supabase Edge Function secrets.");
  const response = await getJson("https://api.groq.com/openai/v1/models", headerBearer(key));
  if (!response.ok) return providerResult("groq", errorStatus(response), "Groq model-list API rejected the request.");
  const models = Array.isArray(response.data.data) ? response.data.data : [];
  return providerResult("groq", models.length ? "ready" : "valid_key_no_models",
    models.length ? "Credential accepted and model access is available." : "Credential accepted, but no models were returned.");
}

async function probeOpenRouter(): Promise<ProviderHealthItem> {
  const key = firstSecret(["OPENROUTER_API_KEY"]);
  if (isPlaceholderKey(key)) return providerResult("openrouter", "missing_secret", "Add OPENROUTER_API_KEY in Supabase Edge Function secrets.");
  const response = await getJson("https://openrouter.ai/api/v1/auth/key", headerBearer(key));
  if (!response.ok) return providerResult("openrouter", errorStatus(response), "OpenRouter key verification endpoint rejected the request.");
  const data = response.data.data && typeof response.data.data === "object"
    ? response.data.data as Record<string, unknown>
    : response.data;
  if (data.disabled === true) return providerResult("openrouter", "key_disabled", "OpenRouter reports this key is disabled.");
  if (typeof data.limit_remaining === "number" && data.limit_remaining <= 0) {
    return providerResult("openrouter", "valid_key_limit_exhausted", "Credential accepted, but the key's usage limit is exhausted.");
  }
  return providerResult("openrouter", "ready", "OpenRouter accepted the key; no generation request was made.");
}

async function probeDeepSeek(): Promise<ProviderHealthItem> {
  const key = firstSecret(["DEEPSEEK_API_KEY", "DeepSeek"]);
  if (isPlaceholderKey(key)) return providerResult("deepseek", "missing_secret", "Add DEEPSEEK_API_KEY (or the existing DeepSeek secret) in Supabase.");
  const response = await getJson("https://api.deepseek.com/user/balance", headerBearer(key));
  if (!response.ok) return providerResult("deepseek", errorStatus(response), "DeepSeek balance endpoint rejected the request.");
  if (response.data.is_available === false) {
    return providerResult("deepseek", "valid_key_no_balance", "Credential accepted, but DeepSeek reports no usable balance.");
  }
  return providerResult("deepseek", "ready", "DeepSeek accepted the key; only the balance endpoint was called.");
}

async function probeOpenAI(): Promise<ProviderHealthItem> {
  const key = firstSecret(["OPENAI_API_KEY"]);
  if (isPlaceholderKey(key)) return providerResult("openai", "missing_secret", "Add OPENAI_API_KEY in Supabase Edge Function secrets.");
  const response = await getJson("https://api.openai.com/v1/models", headerBearer(key));
  if (!response.ok) return providerResult("openai", errorStatus(response), "OpenAI model-list API rejected the request.");
  return providerResult("openai", "ready", "OpenAI accepted the key; no completion was generated.");
}

async function probeAnthropic(): Promise<ProviderHealthItem> {
  const key = firstSecret(["ANTHROPIC_API_KEY"]);
  if (isPlaceholderKey(key)) return providerResult("anthropic", "missing_secret", "Add ANTHROPIC_API_KEY in Supabase Edge Function secrets.");
  const response = await getJson("https://api.anthropic.com/v1/models?limit=100", {
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
  });
  if (!response.ok) return providerResult("anthropic", errorStatus(response), "Anthropic model-list API rejected the request.");
  const list = Array.isArray(response.data.data) ? response.data.data as Array<Record<string, unknown>> : [];
  const configured = (Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001").trim();
  const hasModel = list.some((model) => model.id === configured);
  return providerResult("anthropic", hasModel ? "ready" : "valid_key_model_not_listed",
    hasModel ? "Credential accepted and the configured model is listed." :
      "Credential accepted, but the configured ANTHROPIC_MODEL was not in the first returned model page.");
}

async function probeVenice(): Promise<ProviderHealthItem> {
  const key = firstSecret(["VENICE_API_KEY", "VENICEAI_API_KEY", "VENICE", "Venice AI"]);
  if (isPlaceholderKey(key)) return providerResult("venice", "missing_secret", "Add VENICE_API_KEY (or the existing Venice secret) in Supabase.");
  const response = await getJson("https://api.venice.ai/api/v1/api_keys/rate_limits", headerBearer(key));
  if (!response.ok) return providerResult("venice", errorStatus(response), "Venice key/rate-limit endpoint rejected the request.");
  const data = response.data.data && typeof response.data.data === "object"
    ? response.data.data as Record<string, unknown>
    : {};
  if (data.accessPermitted === false) return providerResult("venice", "valid_key_access_blocked", "Venice does not currently permit API access for this key.");
  return providerResult("venice", "ready", "Venice accepted the key; balance and rate-limit details were not exposed.");
}

async function probeShannon(): Promise<ProviderHealthItem> {
  const key = firstSecret(["SHANNON_API_KEY", "SHANNONAI_API_KEY", "SHANNON_AI_API_KEY", "Shannon AI"]);
  if (isPlaceholderKey(key)) return providerResult("shannon", "missing_secret", "Add SHANNON_API_KEY (or the existing Shannon AI secret) in Supabase.");
  const response = await getJson("https://api.shannon-ai.com/v1/models", headerBearer(key));
  if (!response.ok) {
    if (response.status === 404 || response.status === 405) {
      return providerResult("shannon", "probe_endpoint_unsupported", "Shannon's model-list probe is unavailable; this does not prove the key is invalid.");
    }
    return providerResult("shannon", errorStatus(response), "Shannon model-list endpoint rejected the request.");
  }
  return providerResult("shannon", "ready", "Shannon accepted the key; no chat completion was generated.");
}

async function probeCloudflare(): Promise<ProviderHealthItem> {
  const credentials = cloudflareCredentials();
  if (isPlaceholderKey(credentials.token)) {
    return providerResult("cloudflare", "missing_secret", "Add CLOUDFLARE_API_TOKEN (or the compatible Cloudflare token secret).");
  }
  if (!credentials.accountId || /^YOUR_.+$/i.test(credentials.accountId)) {
    return providerResult("cloudflare", "missing_account_id", "Add CLOUDFLARE_ACCOUNT_ID; the account ID is separate from the API token.");
  }
  const verify = await getJson("https://api.cloudflare.com/client/v4/user/tokens/verify", headerBearer(credentials.token));
  if (!verify.ok) return providerResult("cloudflare", errorStatus(verify), "Cloudflare token verification failed.");
  const tokenResult = verify.data.result && typeof verify.data.result === "object"
    ? verify.data.result as Record<string, unknown>
    : {};
  if (tokenResult.status !== "active") {
    return providerResult("cloudflare", "token_not_active", "Cloudflare reports that the configured token is not active.");
  }
  const modelPath = "https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(credentials.accountId) +
    "/ai/models/search?search=glm-4.7-flash&per_page=1";
  const modelResponse = await getJson(modelPath, headerBearer(credentials.token));
  if (!modelResponse.ok) return providerResult("cloudflare", errorStatus(modelResponse), "Token is active, but Workers AI model-list access failed for the configured account.");
  if (modelResponse.data.success === false) {
    return providerResult("cloudflare", "workers_ai_access_failed", "Cloudflare token is valid, but Workers AI model-list access failed.");
  }
  return providerResult("cloudflare", "ready", "Token is active and the account can query Workers AI models; no model was run.");
}

async function probeOmdb(): Promise<ProviderHealthItem> {
  const key = firstSecret(["OMDB_API_KEY"]);
  if (isPlaceholderKey(key)) return providerResult("omdb", "missing_secret", "Add OMDB_API_KEY in Supabase Edge Function secrets.");
  // This makes one metadata lookup (no AI-generation call); it consumes one OMDb API request.
  const qs = new URLSearchParams({ apikey: key, t: "Inception", type: "movie" });
  const response = await getJson("https://www.omdbapi.com/?" + qs.toString(), {});
  if (!response.ok) return providerResult("omdb", errorStatus(response), "OMDb lookup endpoint failed.");
  const error = typeof response.data.Error === "string" ? response.data.Error.toLowerCase() : "";
  if (error.includes("invalid api key") || error.includes("api key")) {
    return providerResult("omdb", "invalid_key", "OMDb rejected the configured API key.");
  }
  if (response.data.Response === "True" && typeof response.data.imdbID === "string") {
    return providerResult("omdb", "ready", "OMDb accepted the key and returned a verified title response.");
  }
  return providerResult("omdb", "lookup_not_verified", "OMDb returned a response that did not confirm the test title.");
}

export async function checkProviderHealth(options: { includeOmdb?: boolean } = {}): Promise<{
  checkedAt: string;
  paidFallbackEnabled: boolean;
  providers: ProviderHealthItem[];
}> {
  const probes = [
    probeGemini(),
    probeGroq(),
    probeOpenRouter(),
    probeDeepSeek(),
    probeOpenAI(),
    probeAnthropic(),
    probeVenice(),
    probeCloudflare(),
    probeShannon(),
  ];
  if (options.includeOmdb === true) probes.push(probeOmdb());
  const providers = await Promise.all(probes);
  return {
    checkedAt: new Date().toISOString(),
    paidFallbackEnabled: Deno.env.get("ENABLE_PAID_FALLBACK")?.trim().toLowerCase() === "true",
    providers,
  };
}
