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

function isConfigured(provider: Provider): boolean {
  const value = provider === "deepseek"
    ? (Deno.env.get("DEEPSEEK_API_KEY") ?? Deno.env.get("DeepSeek"))
    : Deno.env.get(ENV_KEY[provider]);
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
    return ["gemini", "groq", "openrouter", "deepseek", "openai"];
  }
  return ["groq", "openrouter", "deepseek", "gemini", "openai"];
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
        failures.push("no usable result");
        continue;
      }

      const note = "Details processed successfully.";
      return { result, provider, note };
    } catch (error) {
      failures.push(shortError(error));
    }
  }

  return {
    result: null,
    provider: null,
    note: "Some details could not be filled automatically. Available source metadata has been kept; please review the fields before saving.",
  };
}
