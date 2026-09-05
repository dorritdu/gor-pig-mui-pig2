import { configFromEnv } from "../src/allowlist.js";
import type { GeminiClient } from "../src/gemini.js";
import type { BotDeps } from "../src/handlers.js";
import { MemoryRepo } from "../src/memory-repo.js";
import type { TelegramClient, TelegramUpdate } from "../src/telegram.js";
import type { ExtractResult } from "../src/types.js";
import { parseExtractJson } from "../src/extract.js";
import { PICNIC_EXTRACT_JSON } from "./fixtures/picnic-notice.js";

export class FakeTelegram implements TelegramClient {
  sent: Array<{ chatId: number; text: string; extra?: unknown }> = [];
  callbacks: string[] = [];
  files = new Map<string, { bytes: Uint8Array; mimeType: string; fileName: string }>();

  async sendMessage(chatId: number, text: string, extra?: { replyMarkup?: unknown }): Promise<{ message_id: number }> {
    this.sent.push({ chatId, text, extra });
    return { message_id: this.sent.length };
  }

  async answerCallback(callbackId: string, text?: string): Promise<void> {
    this.callbacks.push(text ? `${callbackId}:${text}` : callbackId);
  }

  async downloadFile(fileId: string) {
    return this.files.get(fileId) ?? { bytes: new Uint8Array(), mimeType: "image/jpeg", fileName: "photo.jpg" };
  }

  lastText(): string {
    return this.sent.at(-1)?.text ?? "";
  }

  texts(): string[] {
    return this.sent.map((item) => item.text);
  }
}

export function picnicGemini(): GeminiClient {
  return {
    async extract(): Promise<ExtractResult> {
      return parseExtractJson(PICNIC_EXTRACT_JSON);
    },
    async answer(question): Promise<string> {
      if (/bring|帶|shoes|白鞋/i.test(question)) {
        return "豬2 21 Mar picnic at Ocean Park. Bring 白鞋, 水, 小食, and a signed reply slip.";
      }
      return "From the saved notices: picnic on 21 Mar 2026.";
    },
  };
}

export function testDeps(options?: {
  now?: Date;
  gemini?: GeminiClient;
  admin?: number;
  parent?: number;
  helper?: number;
}): { deps: BotDeps; repo: MemoryRepo; telegram: FakeTelegram } {
  const repo = new MemoryRepo();
  repo.seedDemoFamily();
  const telegram = new FakeTelegram();
  const admin = options?.admin ?? 111;
  const parent = options?.parent ?? 222;
  const helper = options?.helper ?? 333;
  const deps: BotDeps = {
    repo,
    telegram,
    gemini: options?.gemini ?? picnicGemini(),
    clock: () => options?.now ?? new Date("2026-03-20T04:00:00Z"),
    config: configFromEnv({
      ADMIN_TELEGRAM_IDS: String(admin),
      PARENT_TELEGRAM_IDS: `${admin},${parent}`,
      HELPER_TELEGRAM_IDS: String(helper),
      TIMEZONE: "Asia/Hong_Kong",
    }),
  };
  return { deps, repo, telegram };
}

export function textUpdate(userId: number, text: string, chatId = userId): TelegramUpdate {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: 1,
      text,
      from: { id: userId, first_name: "Du" },
      chat: { id: chatId, type: "private" },
    },
  };
}

export function photoUpdate(userId: number, fileId = "pic1"): TelegramUpdate {
  return {
    update_id: 2,
    message: {
      message_id: 2,
      date: 1,
      caption: "school picnic circular",
      from: { id: userId, first_name: "Du" },
      chat: { id: userId, type: "private" },
      photo: [{ file_id: fileId, file_unique_id: "u", width: 800, height: 600 }],
    },
  };
}

export function callbackUpdate(userId: number, data: string): TelegramUpdate {
  return {
    update_id: 3,
    callback_query: {
      id: "cb1",
      from: { id: userId, first_name: "Du" },
      data,
      message: {
        message_id: 3,
        date: 1,
        chat: { id: userId, type: "private" },
      },
    },
  };
}
