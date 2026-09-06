/**
 * Mac / Node 20 local runner. No Wrangler.
 * Long-polls Telegram and handles updates in-process.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { configFromEnv } from "../src/allowlist.ts";
import { createLlmClient, hasLlmKey } from "../src/llm.ts";
import { handleUpdate, type FileStore } from "../src/handlers.ts";
import { MemoryRepo } from "../src/memory-repo.ts";
import { HttpTelegramClient, type TelegramUpdate } from "../src/telegram.ts";

const ROOT = resolve(import.meta.dirname, "..");
const STATE_PATH = resolve(ROOT, ".local-state.json");
const FILES_DIR = resolve(ROOT, ".local-files");

loadDevVars(resolve(ROOT, ".dev.vars"));
loadDevVars(resolve(ROOT, ".env"));

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token || token.includes("replace-me")) {
  console.error(`
Missing TELEGRAM_BOT_TOKEN.

1. cp .env.example .dev.vars
2. Paste the BotFather token on TELEGRAM_BOT_TOKEN=
3. npm run local
`);
  process.exit(1);
}

const repo = loadRepo();
const telegram = new HttpTelegramClient(token);
const gemini = hasLlmKey(process.env)
  ? createLlmClient(process.env)
  : {
      async extract() {
        throw new Error("Add GROQ_API_KEY to .dev.vars (https://console.groq.com/keys)");
      },
      async answer() {
        throw new Error("Add GROQ_API_KEY to .dev.vars (https://console.groq.com/keys)");
      },
    };

mkdirSync(FILES_DIR, { recursive: true });
const files: FileStore = {
  async put(key, bytes) {
    const safe = key.replace(/[^a-zA-Z0-9._/-]/g, "_");
    const path = resolve(FILES_DIR, safe);
    mkdirSync(resolve(path, ".."), { recursive: true });
    writeFileSync(path, bytes);
    return key;
  },
};

const deps = {
  repo,
  telegram,
  gemini,
  files,
  clock: () => new Date(),
  config: configFromEnv(process.env),
};

await telegramCall(token, "deleteWebhook", { drop_pending_updates: false });
const me = (await telegramCall(token, "getMe", {})) as { ok: boolean; result?: { username?: string } };
const username = me.result?.username || "your_bot";
console.log(`
Bot is running on this Mac (no Cloudflare needed).
Open Telegram and send /whoami to @${username}

Keep this terminal open. Ctrl+C to stop.
`);
if (!hasLlmKey(process.env)) {
  console.log("No GROQ_API_KEY yet — /whoami /kids /today work. Add a Groq key to read photos.\n");
}

let offset = 0;
while (true) {
  try {
    const updates = (await telegramCall(token, "getUpdates", {
      timeout: 25,
      offset,
      allowed_updates: ["message", "callback_query"],
    })) as { ok: boolean; result?: TelegramUpdate[]; description?: string };
    if (!updates.ok) {
      console.error(updates.description || "getUpdates failed");
      await sleep(2000);
      continue;
    }
    for (const update of updates.result ?? []) {
      offset = update.update_id + 1;
      const label = update.message?.text || update.message?.caption || update.callback_query?.data || "update";
      try {
        await handleUpdate(deps, update);
        saveRepo(repo);
        console.log(`handled ${label}`);
      } catch (error) {
        console.error(`failed ${label}:`, error instanceof Error ? error.message : error);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    await sleep(2000);
  }
}

function loadDevVars(path: string): void {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") process.env[key] = value;
  }
}

function loadRepo(): MemoryRepo {
  const repo = new MemoryRepo();
  if (!existsSync(STATE_PATH)) {
    repo.seedDemoFamily();
    saveRepo(repo);
    return repo;
  }
  try {
    const raw = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
      children: MemoryRepo["children"];
      organisations: MemoryRepo["organisations"];
      childOrgs: MemoryRepo["childOrgs"];
      users: MemoryRepo["users"];
      notices: MemoryRepo["notices"];
      events: MemoryRepo["events"];
      tasks: MemoryRepo["tasks"];
      timetable: MemoryRepo["timetable"];
      drafts: Array<[string, MemoryRepo["drafts"] extends Map<string, infer V> ? V : never]>;
      pending: Array<[number, MemoryRepo["pending"] extends Map<number, infer V> ? V : never]>;
      reminders: MemoryRepo["reminders"];
    };
    repo.seedDemoFamily();
    repo.children = raw.children ?? repo.children;
    repo.organisations = raw.organisations ?? repo.organisations;
    repo.childOrgs = raw.childOrgs ?? repo.childOrgs;
    repo.users = raw.users ?? [];
    repo.notices = raw.notices ?? [];
    repo.events = raw.events ?? [];
    repo.tasks = raw.tasks ?? [];
    repo.timetable = raw.timetable ?? repo.timetable;
    repo.drafts = new Map(raw.drafts ?? []);
    repo.pending = new Map(raw.pending ?? []);
    repo.reminders = raw.reminders ?? [];
    repo.resyncIds();
    return repo;
  } catch {
    repo.seedDemoFamily();
    return repo;
  }
}

function saveRepo(repo: MemoryRepo): void {
  writeFileSync(
    STATE_PATH,
    JSON.stringify(
      {
        children: repo.children,
        organisations: repo.organisations,
        childOrgs: repo.childOrgs,
        users: repo.users,
        notices: repo.notices,
        events: repo.events,
        tasks: repo.tasks,
        timetable: repo.timetable,
        drafts: [...repo.drafts.entries()],
        pending: [...repo.pending.entries()],
        reminders: repo.reminders,
      },
      null,
      2,
    ),
  );
}

async function telegramCall(botToken: string, method: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
