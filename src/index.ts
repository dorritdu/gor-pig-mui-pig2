import { configFromEnv } from "./allowlist.js";
import { D1Repo } from "./d1-repo.js";
import { createLlmClient } from "./llm.js";
import { handleScheduled, handleUpdate, type FileStore } from "./handlers.js";
import { HttpTelegramClient, type TelegramUpdate } from "./telegram.js";

export interface Env {
  DB: D1Database;
  FILES?: R2Bucket;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  GEMINI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  GROQ_API_KEY?: string;
  LLM_PROVIDER?: string;
  LLM_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  ADMIN_TELEGRAM_IDS?: string;
  PARENT_TELEGRAM_IDS?: string;
  HELPER_TELEGRAM_IDS?: string;
  TIMEZONE?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json({ ok: true, service: "family-notice-bot" });
    }

    if (request.method === "POST" && (url.pathname === "/telegram" || url.pathname === "/")) {
      const secret = env.TELEGRAM_WEBHOOK_SECRET;
      if (secret) {
        const header = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        if (header !== secret) {
          return json({ ok: false, error: "unauthorized" }, 401);
        }
      }
      const update = (await request.json()) as TelegramUpdate;
      const deps = buildDeps(env);
      await handleUpdate(deps, update);
      return json({ ok: true });
    }

    return json({ ok: false, error: "not found" }, 404);
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const deps = buildDeps(env);
    await handleScheduled(deps, event.cron);
  },
};

function buildDeps(env: Env) {
  const files: FileStore | undefined = env.FILES
    ? {
        async put(key, bytes, mimeType) {
          await env.FILES!.put(key, bytes, { httpMetadata: { contentType: mimeType } });
          return key;
        },
      }
    : undefined;

  return {
    repo: new D1Repo(env.DB),
    telegram: new HttpTelegramClient(env.TELEGRAM_BOT_TOKEN),
    gemini: createLlmClient(env),
    files,
    clock: () => new Date(),
    config: configFromEnv(env),
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
