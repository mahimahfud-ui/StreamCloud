import type { PageInfo } from "./page.ts";
import { askGemini } from "./gemini.ts";
import { askGroq } from "./groq.ts";
import { askOpenAI } from "./openai.ts";
import { askOpenRouter } from "./openrouter.ts";
import { askDeepSeek } from "./deepseek.ts";
import { askAnthropic } from "./anthropic.ts";
import { askVenice } from "./venice.ts";
import { askCloudflare, cloudflareCredentials, isCloudflareConfigured } from "./cloudflare.ts";
import { askShannon } from "./shannon.ts";

type Provider = "gemini" | "groq" | "openrouter" | "deepseek" | "openai" | "anthropic" | "venice" | "cloudflare" | "shannon";
type Task = "metadata" | "summary";
type AIResult = {
  name: string | null;
  description: string | null;
  year: number | null;
  genres: string[];
  platform: string | null;
  version: string | null;
  imdbId: string | null;
};

const ENV_KEY: Record<Provider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  venice: "VENICE_API_KEY",
  cloudflare: "CLOUDFLARE_API_TOKEN",
  shannon: "SHANNON_API_KEY",
};

// Short-lived per-isolate health memory reduces repeated requests to a provider
// that just rejected its key, hit a quota, or returned a transient error.
// Every new isolate rechecks providers.
const providerCooldownUntil = new Map<Provider, number>();

function providerKey(provider: Provider): string {
  if (provider === "deepseek") return (Deno.env.get("DEEPSEEK_API_KEY") || Deno.env.get("DeepSeek") || "").trim();
  if (provider === "venice") {
    return (Deno.env.get("VENICE_API_KEY") || Deno.env.get("VENICEAI_API_KEY") ||
      Deno.env.get("VENICE") || Deno.env.get("Venice AI") || "").trim();
  }
  if (provider === "cloudflare") return cloudflareCredentials().token;
  if (provider === "shannon") {
    return (Deno.env.get("SHANNON_API_KEY") || Deno.env.get("SHANNONAI_API_KEY") ||
      Deno.env.get("SHANNON_AI_API_KEY") || Deno.env.get("Shannon AI") || "").trim();
  }
  return (Deno.env.get(ENV_KEY[provider]) ?? "").trim();
}

function paidFallbackEnabled(): boolean {
  return Deno.env.get("ENABLE_PAID_FALLBACK")?.trim().toLowerCase() === "true";
}

function isConfigured(provider: Provider): boolean {
  const key = providerKey(provider);
  if (!key || key === "এপিয়াই" || /^YOUR_.+_KEY$/i.test(key)) return false;
  // Do not silently spend on providers traditionally requiring paid API billing.
  if ((provider === "deepseek" || provider === "openai" || provider === "anthropic") && !paidFallbackEnabled()) return false;
  if (provider === "cloudflare" && !isCloudflareConfigured()) return false;
  return (providerCooldownUntil.get(provider) ?? 0) <= Date.now();
}

function cooldownFor(error: unknown): number {
  const message = shortError(error).toLowerCase();
  if (/\b401\b|\b403\b|invalid api key|rejected the api key|authentication fails/.test(message)) return 30 * 60_000;
  if (/\b429\b|quota|rate limit|too many requests/.test(message)) return 90_000;
  if (/\b404\b|model .*unavailable|model not found/.test(message)) return 5 * 60_000;
  if (/\b5\d\d\b|timeout|network error|temporarily unavailable/.test(message)) return 30_000;
  return 0;
}

function rememberProviderFailure(provider: Provider, error: unknown): void {
  const delay = cooldownFor(error);
  if (delay) providerCooldownUntil.set(provider, Date.now() + delay);
}

function rememberProviderSuccess(provider: Provider): void {
  providerCooldownUntil.delete(provider);
}

function useful(result: AIResult | null, task: Task): result is AIResult {
  if (!result) return false;
  if (task === "summary") return typeof result.description === "string" && result.description.trim().length > 20;
  return !!(
    result.name || result.description || result.year !== null ||
    result.genres.length || result.platform || result.version || result.imdbId
  );
}

function orderFor(section: string, task: Task): Provider[] {
  // Prefer Gemini for synopsis work; all configured fallbacks remain available.
  if (task === "summary") {
    return ["gemini", "groq", "openrouter", "cloudflare", "venice", "shannon", "anthropic", "deepseek", "openai"];
  }
  // Keep the existing fast/free providers first, then continue across every configured adapter.
  if (section === "movie" || section === "series") {
    return ["groq", "gemini", "openrouter", "cloudflare", "venice", "shannon", "anthropic", "deepseek", "openai"];
  }
  if (section === "music" || section === "apps" || section === "sites") {
    return ["groq", "openrouter", "cloudflare", "venice", "shannon", "gemini", "anthropic", "deepseek", "openai"];
  }
  return ["groq", "gemini", "openrouter", "cloudflare", "venice", "shannon", "anthropic", "deepseek", "openai"];
}

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "unknown error");
  return message.replace(/[\r\n]+/g, " ").replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 180);
}

export async function askAutoAI(
  page: PageInfo,
  section: string,
  task: Task,
): Promise<{ result: AIResult | null; provider: Provider | null; note: string }> {
  const order = orderFor(section, task);
  const failures: string[] = [];
  let configuredCount = 0;

  for (const provider of order) {
    if (!isConfigured(provider)) continue;
    configuredCount++;
    try {
      let result: AIResult | null;
      if (provider === "gemini") result = await askGemini(page, section);
      else if (provider === "groq") result = await askGroq(page, section);
      else if (provider === "openrouter") result = await askOpenRouter(page, section);
      else if (provider === "deepseek") result = await askDeepSeek(page, section);
      else if (provider === "openai") result = await askOpenAI(page, section);
      else if (provider === "anthropic") result = await askAnthropic(page, section);
      else if (provider === "venice") result = await askVenice(page, section);
      else if (provider === "cloudflare") result = await askCloudflare(page, section);
      else result = await askShannon(page, section);

      if (!useful(result, task)) {
        const error = new Error("Provider returned no usable structured result.");
        failures.push(provider + ": " + shortError(error));
        rememberProviderFailure(provider, error);
        continue;
      }

      rememberProviderSuccess(provider);
      return { result, provider, note: "Details processed successfully using " + provider + "." };
    } catch (error) {
      const detail = shortError(error);
      failures.push(provider + ": " + detail);
      rememberProviderFailure(provider, error);
      // Never log credentials or full provider response bodies.
      console.warn("[StreamCloud AI router] provider attempt failed:", provider, detail);
    }
  }

  if (!configuredCount) {
    return {
      result: null,
      provider: null,
      note: "No eligible AI provider is configured for this task. Check the provider secrets and enable ENABLE_PAID_FALLBACK only if paid-provider fallback is intended.",
    };
  }
  return {
    result: null,
    provider: null,
    note: "Configured AI providers could not return usable listing details (" + failures.join("; ").slice(0, 800) +
      "). Available source metadata has been kept; please review the fields before saving.",
  };
}
