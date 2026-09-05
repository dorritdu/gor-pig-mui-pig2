#!/usr/bin/env node
/**
 * Run the Telegram bot on your Mac.
 * Telegram cannot reach localhost, so this long-polls getUpdates
 * and forwards each message to local `wrangler dev`.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = process.env.LOCAL_BOT_PORT || "8787";
const WORKER = `http://127.0.0.1:${PORT}`;

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 22) {
  console.error(`
Wrangler needs Node.js 22+. This Mac is on ${process.version}.

If you use nvm:
  nvm install 22
  nvm use 22
  npm install
  npm run local

If you use Homebrew:
  brew install node@22
  echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zprofile
  export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
  node -v
  npm install
  npm run local
`);
  process.exit(1);
}

loadDevVars(resolve(ROOT, ".dev.vars"));
loadDevVars(resolve(ROOT, ".env"));

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token || token.includes("replace-me")) {
  console.error(`
Missing TELEGRAM_BOT_TOKEN.

1. Copy .env.example to .dev.vars
2. Paste your BotFather token on the TELEGRAM_BOT_TOKEN= line
3. Run: npm run local

Do not commit .dev.vars or paste the token into git.
`);
  process.exit(1);
}

const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "";

await ensureLocalDb();
const wrangler = startWrangler();
await waitForHealth();
await deleteWebhook(token);

const me = await telegram(token, "getMe");
const username = me.result?.username || "your_bot";
console.log(`
Bot is running locally.
Open Telegram and send /whoami to @${username}

Keep this terminal open. Ctrl+C to stop.
`);

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes("replace-me")) {
  console.log("GEMINI_API_KEY is not set yet — /whoami, /kids, /today work; reading photos needs a Gemini key.\n");
}

let offset = 0;
while (true) {
  try {
    const updates = await telegram(token, "getUpdates", { timeout: 25, offset, allowed_updates: ["message", "callback_query"] });
    for (const update of updates.result ?? []) {
      offset = update.update_id + 1;
      const res = await fetch(`${WORKER}/telegram`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { "X-Telegram-Bot-Api-Secret-Token": secret } : {}),
        },
        body: JSON.stringify(update),
      });
      if (!res.ok) {
        console.error(`Worker returned ${res.status}: ${await res.text()}`);
      } else {
        const kind = update.message?.text || update.message?.caption || update.callback_query?.data || "update";
        console.log(`handled ${kind}`);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    await sleep(2000);
  }
}

function loadDevVars(path) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") process.env[key] = value;
  }
}

async function ensureLocalDb() {
  console.log("Preparing local D1 database…");
  await run("npx", ["wrangler", "d1", "execute", "family-notices", "--local", "--file=./schema.sql"]);
  await run("npx", ["wrangler", "d1", "execute", "family-notices", "--local", "--file=./seed.sql"]);
}

function startWrangler() {
  const child = spawn("npx", ["wrangler", "dev", "--port", PORT, "--local"], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`wrangler exited with ${code}`);
      process.exit(code);
    }
  });
  const stop = () => {
    child.kill("SIGTERM");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  return child;
}

async function waitForHealth() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`${WORKER}/health`);
      if (res.ok) return;
    } catch {
      // still booting
    }
    await sleep(500);
  }
  throw new Error("Local worker did not start on port " + PORT);
}

async function deleteWebhook(botToken) {
  const json = await telegram(botToken, "deleteWebhook", { drop_pending_updates: false });
  if (!json.ok) {
    throw new Error(json.description || "deleteWebhook failed");
  }
}

async function telegram(botToken, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

function run(cmd, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
