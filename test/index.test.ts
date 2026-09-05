import { describe, expect, it, vi } from "vitest";

vi.mock("../src/handlers.js", () => ({
  handleUpdate: vi.fn(async () => undefined),
  handleScheduled: vi.fn(async () => undefined),
}));

import worker from "../src/index.js";
import { handleScheduled, handleUpdate } from "../src/handlers.js";

const env = {
  DB: {} as D1Database,
  TELEGRAM_BOT_TOKEN: "token",
  TELEGRAM_WEBHOOK_SECRET: "secret",
  GEMINI_API_KEY: "gemini",
  ADMIN_TELEGRAM_IDS: "111",
};

describe("worker HTTP + cron entry", () => {
  it("serves health", async () => {
    const res = await worker.fetch(new Request("https://bot.example/health"), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("rejects webhook without secret", async () => {
    const res = await worker.fetch(
      new Request("https://bot.example/telegram", {
        method: "POST",
        body: JSON.stringify({ update_id: 1 }),
      }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("accepts webhook with secret", async () => {
    const res = await worker.fetch(
      new Request("https://bot.example/telegram", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "secret" },
        body: JSON.stringify({ update_id: 1, message: { text: "/whoami" } }),
      }),
      env,
    );
    expect(res.status).toBe(200);
    expect(handleUpdate).toHaveBeenCalled();
  });

  it("dispatches cron to scheduled handler", async () => {
    await worker.scheduled({ cron: "0 12 * * *" } as ScheduledEvent, env);
    expect(handleScheduled).toHaveBeenCalledWith(expect.anything(), "0 12 * * *");
  });
});
