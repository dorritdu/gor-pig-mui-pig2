# Family school-notice Telegram bot

A private Telegram bot for a busy family: **2 kids, 3 schools, and tutorial centres**.

Forward a screenshot, PDF, or pasted circular. The bot reads it, asks you to confirm which child, then answers “tomorrow what do we bring?” and sends:

- **20:00 HKT** parent digest (you + partner)
- **07:00 HKT** helper pack list
- **Sunday 08:00 HKT** week-ahead

Hosting is **$0 to run the bot**. Notice photos are read by **Kimi** (`kimi-k3`) on Moonshot’s international API (Hong Kong). Groq and Gemini websites are blocked from Hong Kong — do not use them. Cloudflare Worker + D1 + R2 is for a later public deploy.

The bot cannot open WhatsApp, eClass, or school apps. Forward or screenshot those into Telegram.

## What you can send

- Photos / screen captures of circulars (Kimi `kimi-k3` reads these)
- Pasted text (email body or WhatsApp copy)
- PDF pages you photograph or copy as text
- Questions: “Tomorrow what special activities?”, “豬2 Monday bring what?”, “any reply slips?”

## Commands

| Command | Who | What |
|---|---|---|
| `/whoami` | anyone | Your numeric Telegram id (for the allowlist) |
| `/start` `/help` | family | How to use the bot |
| `/today` `/tomorrow` `/week` | family | Agenda by child |
| `/kids` | family | Children |
| `/timetable` | family | Weekly tutorials / PE |
| `/addschool <name>` | parents | Add a school or tutorial centre |
| `/slips` | parents | Open reply-slip / payment tasks |
| `/remind parent\|helper\|week` | parents | Send a digest now (for testing) |

After a notice, tap **豬1 / 豬2 / Both**, then **Save**. Wrong dates stay out of the calendar until you confirm.

## Run on your Mac first

`npm run local` talks to Telegram from this computer — no Cloudflare.

0. If Terminal says `command not found: npm`, install Node.js first: open [https://nodejs.org](https://nodejs.org), download **LTS**, run the `.pkg` installer, then **quit Terminal fully** (Cmd+Q) and open it again. Check:

```bash
node -v
npm -v
```

You need both commands to print a version. Node 20 or newer is fine.

1. In Terminal, from this project folder:

```bash
git checkout cursor/school-notice-bot-0bf3
git pull
npm install
cp .env.example .dev.vars
```

2. Open `.dev.vars` and paste the BotFather token:

```bash
TELEGRAM_BOT_TOKEN=123456:your-real-token
```

Leave the family id lines empty for the first run. `/whoami`, `/kids`, and `/today` work without a Kimi key.

3. To read photos, open [platform.kimi.ai](https://platform.kimi.ai) on this Mac (Hong Kong uses this international site, **not** platform.kimi.com and **not** console.groq.com). Sign in, create an API key, and put this in `.dev.vars` (replace any Groq or Ollama block):

```bash
LLM_PROVIDER=kimi
MOONSHOT_API_KEY=paste-your-key-here
LLM_MODEL=kimi-k3
```

`kimi-k3` can read photos. Moonshot’s docs say it unlocks after a small top-up (minimum $1). Official vision models: [kimi-k3 and kimi-k2.6](https://platform.kimi.ai/docs/guide/use-kimi-vision-model).

If that page shows `Forbidden`, stop and tell me.

4. Start the bot and keep the terminal open:

```bash
npm run local
```

5. Open Telegram, find your bot, send `/whoami`. You should get your numeric id back.
6. Then try `/kids`, `/today`, `/timetable`. Send a notice photo.

Stop with Ctrl+C. Do not commit `.dev.vars`.

## One-time setup (later: Cloudflare deploy)

### 1. Create the Telegram bot

1. Open [@BotFather](https://t.me/BotFather) → `/newbot`
2. Copy the token
3. Each family member starts the bot and sends `/whoami`. Collect those numeric ids.

### 2. Cloudflare (free)

```bash
npm install
npx wrangler login
npx wrangler d1 create family-notices
npx wrangler r2 bucket create family-notices
```

Put the D1 `database_id` into `wrangler.toml` (replace `REPLACE_WITH_D1_DATABASE_ID`).

```bash
npx wrangler d1 execute family-notices --remote --file=./schema.sql
npx wrangler d1 execute family-notices --remote --file=./seed.sql
```

Edit `seed.sql` first if you want real school names (defaults: 豬1 / 豬2, 學校 A/B/C, 數學/英文/鋼琴).

### 3. Secrets

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET   # long random string
npx wrangler secret put MOONSHOT_API_KEY
npx wrangler secret put LLM_PROVIDER   # kimi
npx wrangler secret put LLM_MODEL      # kimi-k3
npx wrangler secret put ADMIN_TELEGRAM_IDS        # e.g. 111111111
npx wrangler secret put PARENT_TELEGRAM_IDS       # you + partner
npx wrangler secret put HELPER_TELEGRAM_IDS
```

Copy `.env.example` to `.dev.vars` for local `wrangler dev`.

### 4. Deploy and point Telegram at the Worker

```bash
npm test
npx wrangler deploy
```

Note the `*.workers.dev` URL, then:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://family-notice-bot.<you>.workers.dev/telegram" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Cron is already in `wrangler.toml` (UTC times that match 07:00 / 20:00 / Sunday 08:00 Hong Kong).

## GitLab CI (code + deploy only)

GitLab jobs are **not** the bot. They run tests and, on the default branch, `wrangler deploy`.

Set these GitLab CI variables (masked):

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (Workers + D1 + R2 edit)

Worker secrets stay in Cloudflare (`wrangler secret put`), not in GitLab.

## Local development

`npm run local` is the supported Mac path (Node 20, no Wrangler). It long-polls Telegram on this computer.

```bash
npm install
npm test
npm run local
```

## Project layout

```
src/index.ts       Worker webhook + cron entry
src/handlers.ts    Commands, ingest, confirm buttons, Q&A
src/extract.ts     LLM JSON parsing
src/reminders.ts   Parent / helper / week digests
src/d1-repo.ts     D1 persistence
src/memory-repo.ts In-memory repo used by tests
schema.sql / seed.sql
.gitlab-ci.yml
```

## Privacy

Only allowlisted Telegram ids can talk to the bot (`/whoami` is the exception so you can collect ids). Notice photos and text are sent to Kimi (Moonshot) for extraction and answers.
