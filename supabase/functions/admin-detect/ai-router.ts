import type { PageInfo } from "./page.ts";
import { askGemini } from "./gemini.ts";
import { askGroq } from "./groq.ts";
import { askOpenAI } from "./openai.ts";
import { askOpenRouter } from "./openrouter.ts";
import { askDeepSeek } from "./deepseek.ts";

type Provider = "gemini" | "groq" | "openrouter" | "deepseek" | "openai";
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
};

// Short-lived, per-isolate health memory prevents repeated attempts against a
// provider that just rejected its key, hit a quota, or returned a transient error.
// This is only an optimization: every new isolate rechecks providers.
const providerCooldownUntil = new Map<Provider, number>();

function providerKey(provider: Provider): string {
  const value = provider === "deepseek"
    ? (Deno.env.get("DEEPSEEK_API_KEY") || Deno.env.get("DeepSeek"))
    : Deno.env.get(ENV_KEY[provider]);
  return (value ?? "").trim();
}

function isConfigured(provider: Provider): boolean {
  const key = providerKey(provider);
  if (!key || key === "এপিয়াই") return false;
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
  // Use Gemini for summaries; its response is then checked for a usable description.
  if (task === "summary") {
    return ["gemini", "groq", "openrouter", "deepseek", "openai"];
  }
  // Groq's strict JSON-schema support is a good first choice for metadata extraction.
  if (section === "movie" || section === "series") {
    return ["groq", "gemini", "openrouter", "deepseek", "openai"];
  }
  // Website/app/music extraction uses Groq first. OpenRouter can choose a free,
  // feature-compatible model dynamically; paid OpenAI remains the final fallback.
  if (section === "music" || section === "apps" || section === "sites") {
    return ["groq", "openrouter", "deepseek", "gemini", "openai"];
  }
  return ["groq", "gemini", "openrouter", "deepseek", "openai"];
}
function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "unknown error");
  return message.replace(/[\r\n]+/g, " ").slice(0, 180);
}

export async function askAutoAI(
  page: PageInfo,
  section: string,
  task: Task,
): Promise<{ result: AIResult | null; provider: Provider | null; note: string }> {
  const order = orderFor(section, task);
  const failures: string[] = [];

  for (const provider of order) {
    if (!isConfigured(provider)) continue;
    try {
      let result: AIResult | null;
      if (provider === "gemini") result = await askGemini(page, section);
      else if (provider === "groq") result = await askGroq(page, section);
      else if (provider === "openrouter") result = await askOpenRouter(page, section);
      else if (provider === "deepseek") result = await askDeepSeek(page, section);
      else result = await askOpenAI(page, section);

      if (!useful(result, task)) {
        const error = new Error("Provider returned no usable structured result.");
        failures.push(provider + ": " + shortError(error));
        rememberProviderFailure(provider, error);
        continue;
      }

      rememberProviderSuccess(provider);
      const note = "Details processed successfully using " + provider + ".";
      return { result, provider, note };
    } catch (error) {
      const detail = shortError(error);
      failures.push(provider + ": " + detail);
      rememberProviderFailure(provider, error);
      // Never log credentials or full provider response bodies.
      console.warn("[StreamCloud AI router] provider attempt failed:", provider, detail);
    }
  }

  return {
    result: null,
    provider: null,
    note: "Some details could not be filled automatically. Available source metadata has been kept; please review the fields before saving.",
  };
}
