export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface DownloadedFile {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
}

export interface TelegramClient {
  sendMessage(
    chatId: number,
    text: string,
    extra?: {
      replyMarkup?: { inline_keyboard: InlineKeyboardButton[][] };
    },
  ): Promise<{ message_id: number }>;
  answerCallback(callbackId: string, text?: string): Promise<void>;
  downloadFile(fileId: string): Promise<DownloadedFile>;
}

export class HttpTelegramClient implements TelegramClient {
  constructor(private readonly token: string) {}

  async sendMessage(
    chatId: number,
    text: string,
    extra?: { replyMarkup?: { inline_keyboard: InlineKeyboardButton[][] } },
  ): Promise<{ message_id: number }> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: clip(text, 3900),
    };
    if (extra?.replyMarkup) body.reply_markup = extra.replyMarkup;
    const result = await telegramCall<{ message_id: number }>(this.token, "sendMessage", body);
    return { message_id: result.message_id };
  }

  async answerCallback(callbackId: string, text?: string): Promise<void> {
    await telegramCall(this.token, "answerCallbackQuery", {
      callback_query_id: callbackId,
      text: text ?? "",
    });
  }

  async downloadFile(fileId: string): Promise<DownloadedFile> {
    const meta = await telegramCall<{ file_path: string }>(this.token, "getFile", { file_id: fileId });
    const url = `https://api.telegram.org/file/bot${this.token}/${meta.file_path}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Telegram file download failed: ${response.status}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const fileName = meta.file_path.split("/").pop() || "file";
    const mimeType = guessMime(fileName, response.headers.get("content-type"));
    return { bytes, mimeType, fileName };
  }
}

async function telegramCall<T>(token: string, method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as { ok: boolean; result: T; description?: string };
  if (!json.ok) {
    throw new Error(json.description || `Telegram ${method} failed`);
  }
  return json.result;
}

function guessMime(fileName: string, header: string | null): string {
  if (header && header !== "application/octet-stream") return header;
  if (fileName.endsWith(".pdf")) return "application/pdf";
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) return "image/jpeg";
  if (fileName.endsWith(".webp")) return "image/webp";
  return header || "application/octet-stream";
}

export function clip(text: string, max = 3900): string {
  return text.length <= max ? text : `${text.slice(0, max - 20)}\n…(truncated)`;
}

export function displayName(user: TelegramUser): string {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || String(user.id);
}

export function draftKeyboard(draftId: string): { inline_keyboard: InlineKeyboardButton[][] } {
  return {
    inline_keyboard: [
      [
        { text: "豬1", callback_data: `k:${draftId}:1` },
        { text: "豬2", callback_data: `k:${draftId}:2` },
        { text: "Both", callback_data: `k:${draftId}:b` },
      ],
      [
        { text: "Save", callback_data: `s:${draftId}` },
        { text: "Discard", callback_data: `x:${draftId}` },
      ],
    ],
  };
}

export function addSchoolTypeKeyboard(): { inline_keyboard: InlineKeyboardButton[][] } {
  return {
    inline_keyboard: [
      [
        { text: "School", callback_data: "as:school" },
        { text: "Tutorial", callback_data: "as:tutorial" },
      ],
    ],
  };
}

export function addSchoolKidsKeyboard(): { inline_keyboard: InlineKeyboardButton[][] } {
  return {
    inline_keyboard: [
      [
        { text: "豬1", callback_data: "ak:1" },
        { text: "豬2", callback_data: "ak:2" },
        { text: "Both", callback_data: "ak:b" },
      ],
    ],
  };
}

export function taskDoneKeyboard(taskId: number): { inline_keyboard: InlineKeyboardButton[][] } {
  return {
    inline_keyboard: [[{ text: "Mark done", callback_data: `t:${taskId}` }]],
  };
}
