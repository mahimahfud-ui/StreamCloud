import type { PageInfo } from "./page.ts";
import { askGemini } from "./gemini.ts";
import { askGroq } from "./groq.ts";
import { askOpenAI } from "./openai.ts";

type Provider = "gemini" | "groq" | "openai";
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

const LABEL: Record<Provider, string> = {
  gemini: "Gemini AI",
  groq: "GroqCloud",
  openai: "OpenAI GPT",
};

const ENV_KEY: Record<Provider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  openai: "OPENAI_API_KEY",
};

function isConfigured(provider: Provider): boolean {
  const value = Deno.env.get(ENV_KEY[provider]);
  return !!value && value.trim() !== "এপিয়াই";
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
  // Movie/series synopsis and title tasks start with Gemini; website/app/music
  // extraction starts with Groq. OpenAI is last to avoid unnecessary paid API calls.
  if (task === "summary" || section === "movie" || section === "series") {
    return ["gemini", "groq", "openai"];
  }
  return ["groq", "gemini", "openai"];
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
  let configuredCount = 0;

  for (const provider of order) {
    if (!isConfigured(provider)) continue;
    configuredCount++;
    try {
      let result: AIResult | null;
      if (provider === "gemini") result = await askGemini(page, section);
      else if (provider === "groq") result = await askGroq(page, section);
      else result = await askOpenAI(page, section);

      if (!useful(result, task)) {
        failures.push(LABEL[provider] + " returned no usable result");
        continue;
      }

      const note = failures.length
        ? "Auto AI switched to " + LABEL[provider] + " after " + failures.join("; ") + "."
        : "Auto AI selected " + LABEL[provider] + " for this task.";
      return { result, provider, note };
    } catch (error) {
      failures.push(LABEL[provider] + " failed (" + shortError(error) + ")");
    }
  }

  const reason = configuredCount === 0
    ? "No AI provider API key is configured."
    : "All configured providers failed: " + failures.join("; ") + ".";
  return {
    result: null,
    provider: null,
    note: "Auto AI unavailable: " + reason + " Add one or more provider keys in Supabase Edge Function Secrets. The site will use verified/source metadata where possible.",
  };
}
