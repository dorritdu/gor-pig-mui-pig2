import { HttpGeminiClient, type GeminiClient } from "./gemini.js";
import { buildExtractPrompt, parseExtractJson } from "./extract.js";
import { buildQaContext } from "./qa.js";
import type { AgendaItem } from "./format.js";
import type { Child, ExtractResult, Organisation, Task } from "./types.js";

export type LlmClient = GeminiClient;

export interface LlmEnv {
  LLM_PROVIDER?: string;
  LLM_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  DEEPSEEK_API_KEY?: string;
  MOONSHOT_API_KEY?: string;
  KIMI_API_KEY?: string;
}

function missingKeyClient(message: string): LlmClient {
  return {
    async extract() {
      throw new Error(message);
    },
    async answer() {
      throw new Error(message);
    },
  };
}

export function kimiApiKey(env: LlmEnv): string {
  return env.MOONSHOT_API_KEY?.trim() || env.KIMI_API_KEY?.trim() || "";
}

const KIMI_MISSING =
  "Add MOONSHOT_API_KEY to .dev.vars. Create a key at https://platform.kimi.ai (Hong Kong uses this site).";

export function createLlmClient(env: LlmEnv): LlmClient {
  const provider = inferProvider(env);
  if (provider === "none" || provider === "") {
    return missingKeyClient(KIMI_MISSING);
  }
  if (provider === "kimi" || provider === "moonshot") {
    const key = kimiApiKey(env);
    if (!key) return missingKeyClient(KIMI_MISSING);
    return new OpenAiCompatClient({
      name: "Kimi",
      apiKey: key,
      baseUrl: DEFAULT_KIMI_BASE_URL,
      model: env.LLM_MODEL || DEFAULT_KIMI_MODEL,
      fallbacks: KIMI_VISION_MODELS,
      supportsVision: true,
      sendTemperature: false,
    });
  }
  if (provider === "deepseek") {
    const key = env.DEEPSEEK_API_KEY?.trim();
    if (!key) {
      return missingKeyClient("DEEPSEEK_API_KEY is missing. Create one at https://platform.deepseek.com");
    }
    return new OpenAiCompatClient({
      name: "DeepSeek",
      apiKey: key,
      baseUrl: "https://api.deepseek.com",
      model: env.LLM_MODEL || "deepseek-chat",
      supportsVision: false,
    });
  }
  if (provider === "openrouter") {
    const key = env.OPENROUTER_API_KEY?.trim();
    if (!key) {
      return missingKeyClient("OPENROUTER_API_KEY is missing. Create one at https://openrouter.ai/keys");
    }
    return new OpenAiCompatClient({
      name: "OpenRouter",
      apiKey: key,
      baseUrl: "https://openrouter.ai/api/v1",
      model: env.LLM_MODEL || DEFAULT_OPENROUTER_MODEL,
      fallbacks: OPENROUTER_FREE_VISION_MODELS,
      extraHeaders: {
        "HTTP-Referer": "https://github.com/dorritdu/gor-pig-mui-pig2",
        "X-Title": "Family notice bot",
      },
    });
  }
  if (provider === "groq") {
    const key = env.GROQ_API_KEY?.trim();
    if (!key) return missingKeyClient("GROQ_API_KEY is missing. Create one at https://console.groq.com/keys");
    return new OpenAiCompatClient({
      name: "Groq",
      apiKey: key,
      baseUrl: "https://api.groq.com/openai/v1",
      model: env.LLM_MODEL || DEFAULT_GROQ_MODEL,
      fallbacks: GROQ_VISION_MODELS,
      supportsVision: true,
    });
  }
  if (provider === "openai" || provider === "ollama") {
    const key = env.OPENAI_API_KEY?.trim() || "ollama";
    const baseUrl = (env.OPENAI_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, "");
    return new OpenAiCompatClient({
      name: provider === "ollama" ? "Ollama" : "OpenAI-compatible",
      apiKey: key,
      baseUrl,
      model: env.LLM_MODEL || DEFAULT_OLLAMA_MODEL,
      supportsVision: true,
    });
  }
  if (provider === "gemini") {
    const key = env.GEMINI_API_KEY?.trim();
    if (!key) return missingKeyClient("GEMINI_API_KEY is missing (not available in Hong Kong — use OpenRouter)");
    return new HttpGeminiClient(key);
  }
  throw new Error(
    `Unknown LLM_PROVIDER=${provider}. Use kimi, ollama, deepseek, openrouter, groq, openai, or gemini.`,
  );
}

export function inferProvider(env: LlmEnv): string {
  const explicit = env.LLM_PROVIDER?.trim().toLowerCase();
  if (explicit === "moonshot") return "kimi";
  if (explicit) return explicit;
  if (kimiApiKey(env)) return "kimi";
  const base = env.OPENAI_BASE_URL?.trim() ?? "";
  if (base.includes("11434") || base.includes("ollama")) return "ollama";
  if (env.GROQ_API_KEY?.trim()) return "groq";
  if (env.DEEPSEEK_API_KEY?.trim()) return "deepseek";
  if (env.OPENROUTER_API_KEY?.trim()) return "openrouter";
  if (env.GEMINI_API_KEY?.trim()) return "gemini";
  if (env.OPENAI_API_KEY?.trim() || env.OPENAI_BASE_URL?.trim()) return "openai";
  return "none";
}

export function hasLlmKey(env: LlmEnv): boolean {
  const provider = inferProvider(env);
  if (provider === "none" || provider === "") return false;
  if (provider === "kimi") return Boolean(kimiApiKey(env));
  if (provider === "ollama") return true;
  return true;
}

export const DEFAULT_KIMI_MODEL = "kimi-k3";
export const DEFAULT_KIMI_BASE_URL = "https://api.moonshot.ai/v1";

/** Official vision IDs: https://platform.kimi.ai/docs/guide/use-kimi-vision-model */
export const KIMI_VISION_MODELS = ["kimi-k3", "kimi-k2.6"];

export const DEFAULT_OLLAMA_MODEL = "qwen2.5vl";
export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";

export const DEFAULT_GROQ_MODEL = "qwen/qwen3.6-27b";

export const GROQ_VISION_MODELS = [
  "qwen/qwen3.6-27b",
  "qwen/qwen3.8-27b",
];

export const DEFAULT_OPENROUTER_MODEL = "openrouter/free";

export const OPENROUTER_FREE_VISION_MODELS = [
  "openrouter/free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
];

export function modelsToTry(preferred: string, fallbacks: string[] = []): string[] {
  return [...new Set([preferred, ...fallbacks].filter(Boolean))];
}

interface OpenAiCompatOptions {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  fallbacks?: string[];
  extraHeaders?: Record<string, string>;
  supportsVision?: boolean;
  sendTemperature?: boolean;
}

export class OpenAiCompatClient implements LlmClient {
  constructor(private readonly options: OpenAiCompatOptions) {}

  async extract(input: {
    text?: string;
    imageBase64?: string;
    mimeType?: string;
    children: Child[];
    organisations: Organisation[];
  }): Promise<ExtractResult> {
    const canSeeImage = this.options.supportsVision !== false;
    if (input.imageBase64 && !input.text && !canSeeImage) {
      throw new Error(
        "This model cannot read photos. Paste the circular as text, or use Kimi (kimi-k3).",
      );
    }
    const content = buildOpenAiContent({
      text: [buildExtractPrompt(input.children, input.organisations), input.text ? `Notice text / caption:\n${input.text}` : ""]
        .filter(Boolean)
        .join("\n\n"),
      imageBase64: canSeeImage ? input.imageBase64 : undefined,
      mimeType: canSeeImage ? input.mimeType : undefined,
    });
    const text = await this.complete(content);
    const parsed = parseExtractJson(text);
    if (!parsed.rawText && input.text) parsed.rawText = input.text;
    return parsed;
  }

  async answer(
    question: string,
    items: AgendaItem[],
    tasks: Task[],
    children: Child[],
    snippets: string[],
  ): Promise<string> {
    return this.complete([{ type: "text", text: buildQaContext(question, items, tasks, children, snippets) }]);
  }

  private async complete(content: OpenAiContentPart[]): Promise<string> {
    const models = modelsToTry(this.options.model, this.options.fallbacks);
    const messageContent = content.length === 1 && content[0]?.type === "text" ? content[0].text : content;
    let lastError = "";
    for (const model of models) {
      const payload: Record<string, unknown> = {
        model,
        messages: [{ role: "user", content: messageContent }],
      };
      if (this.options.sendTemperature !== false) payload.temperature = 0.2;
      // K3 forbids custom temperature and always thinks; low keeps notice extracts faster.
      // https://platform.kimi.ai/docs/guide/kimi-k3-quickstart
      if (model.startsWith("kimi-k3")) payload.reasoning_effort = "low";
      const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.options.apiKey}`,
          ...this.options.extraHeaders,
        },
        body: JSON.stringify(payload),
      });
      const raw = await response.text();
      if (response.ok) return parseOpenAiChatText(raw);
      lastError = `${this.options.name} ${response.status}: ${raw.slice(0, 180)}`;
      if (![400, 402, 403, 404, 429].includes(response.status)) break;
    }
    throw new Error(lastError || `${this.options.name} request failed`);
  }
}

export type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export function buildOpenAiContent(input: {
  text: string;
  imageBase64?: string;
  mimeType?: string;
}): OpenAiContentPart[] {
  const parts: OpenAiContentPart[] = [{ type: "text", text: input.text }];
  if (input.imageBase64 && input.mimeType) {
    parts.push({
      type: "image_url",
      image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}` },
    });
  }
  return parts;
}

export function parseOpenAiChatText(raw: string): string {
  const json = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content
        .map((part) => (typeof part === "object" && part && "text" in part ? String((part as { text?: string }).text ?? "") : ""))
        .join("")
    : typeof content === "string"
      ? content
      : "";
  if (!text.trim()) throw new Error("LLM returned an empty response");
  return text.trim();
}
