import { isAllowed, roleFor } from "./allowlist.js";
import { collectAgenda, itemsOnDay, tasksRelevantToDay } from "./agenda.js";
import { formatAgenda, formatDraftCard, formatHelp, formatKids, formatTimetable, formatWeekList } from "./format.js";
import { looksLikeNotice } from "./extract.js";
import { answerFromCalendar, looksLikeAgendaQuery } from "./qa.js";
import type { FamilyRepo } from "./repo.js";
import { buildReminderMessage, reminderKindFromCron, reminderLogKey, type ReminderKind } from "./reminders.js";
import { applyChildOverride, persistDraft, shortId } from "./save.js";
import {
  addSchoolKidsKeyboard,
  addSchoolTypeKeyboard,
  displayName,
  draftKeyboard,
  taskDoneKeyboard,
  type TelegramCallbackQuery,
  type TelegramClient,
  type TelegramMessage,
  type TelegramUpdate,
} from "./telegram.js";
import { addDays, todayAndRange } from "./time.js";
import type { AppConfig, ChildTag, OrgType, Role } from "./types.js";
import type { GeminiClient } from "./gemini.js";
import { bytesToBase64 } from "./gemini.js";

export interface FileStore {
  put(key: string, bytes: Uint8Array, mimeType: string): Promise<string>;
}

export interface BotDeps {
  repo: FamilyRepo;
  telegram: TelegramClient;
  gemini: GeminiClient;
  files?: FileStore;
  clock: () => Date;
  config: AppConfig;
}

const PUBLIC_COMMANDS = new Set(["/whoami", "/start"]);

export async function handleUpdate(deps: BotDeps, update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    await handleCallback(deps, update.callback_query);
    return;
  }
  if (update.message) {
    await handleMessage(deps, update.message);
  }
}

async function handleMessage(deps: BotDeps, message: TelegramMessage): Promise<void> {
  const from = message.from;
  if (!from) return;
  const chatId = message.chat.id;
  const text = (message.text || message.caption || "").trim();
  const command = text.split(/\s+/)[0]?.split("@")[0] ?? "";

  if (command === "/whoami") {
    await deps.telegram.sendMessage(chatId, `Your Telegram id is ${from.id}\nName: ${displayName(from)}`);
    return;
  }

  if (!isAllowed(deps.config, from.id)) {
    await deps.telegram.sendMessage(
      chatId,
      `This bot is private. Send /whoami and ask the admin to add ${from.id} to the allowlist.`,
    );
    return;
  }

  const role = roleFor(deps.config, from.id) ?? "parent";
  await deps.repo.upsertUser(from.id, displayName(from), role);

  if (command === "/start" || command === "/help") {
    await deps.telegram.sendMessage(chatId, formatHelp(role));
    return;
  }
  if (command === "/kids") {
    await deps.telegram.sendMessage(chatId, formatKids(await deps.repo.listChildren()));
    return;
  }
  if (command === "/today") {
    await sendAgenda(deps, chatId, "today", role);
    return;
  }
  if (command === "/tomorrow") {
    await sendAgenda(deps, chatId, "tomorrow", role);
    return;
  }
  if (command === "/week") {
    await sendAgenda(deps, chatId, "week", role);
    return;
  }
  if (command === "/timetable") {
    const [slots, children] = await Promise.all([deps.repo.listTimetable(), deps.repo.listChildren()]);
    await deps.telegram.sendMessage(chatId, formatTimetable(slots, children));
    return;
  }
  if (command === "/slips") {
    await sendSlips(deps, chatId);
    return;
  }
  if (command === "/addschool") {
    const name = text.replace(/^\/addschool(@\w+)?/i, "").trim();
    if (!name) {
      await deps.telegram.sendMessage(chatId, "Usage: /addschool 黃埔數學");
      return;
    }
    await deps.repo.setPending({
      telegramId: from.id,
      kind: "addschool_type",
      name,
      createdAt: deps.clock().toISOString(),
    });
    await deps.telegram.sendMessage(chatId, `Add “${name}” as:`, { replyMarkup: addSchoolTypeKeyboard() });
    return;
  }
  if (command === "/notice") {
    const body = text.replace(/^\/notice(@\w+)?/i, "").trim();
    if (!body) {
      await deps.telegram.sendMessage(chatId, "Paste the circular after /notice, or send a photo / PDF.");
      return;
    }
    await ingestMedia(deps, { ...message, text: body, photo: undefined, document: undefined }, from.id, chatId, body);
    return;
  }
  if (command === "/remind") {
    if (role !== "admin" && role !== "parent") {
      await deps.telegram.sendMessage(chatId, "Only parents can trigger a reminder.");
      return;
    }
    const which = (text.split(/\s+/)[1] || "parent").toLowerCase();
    const kind: ReminderKind =
      which === "helper" ? "helper_morning" : which === "week" ? "week_ahead" : "parent_evening";
    const body = await buildReminderMessage(deps.repo, kind, deps.clock(), deps.config.timezone);
    await deps.telegram.sendMessage(chatId, body);
    return;
  }

  if (message.photo?.length || message.document) {
    await ingestMedia(deps, message, from.id, chatId, text);
    return;
  }

  if (!text) return;

  const pending = await deps.repo.getPending(from.id);
  if (pending) {
    await deps.telegram.sendMessage(chatId, "Please use the buttons to finish adding the school, or send /addschool again.");
    return;
  }

  if (looksLikeNotice(text)) {
    await ingestMedia(deps, message, from.id, chatId, text);
    return;
  }

  await answerQuestion(deps, chatId, text, role);
}

async function handleCallback(deps: BotDeps, query: TelegramCallbackQuery): Promise<void> {
  const data = query.data ?? "";
  const chatId = query.message?.chat.id;
  if (!chatId) {
    await deps.telegram.answerCallback(query.id);
    return;
  }
  if (!isAllowed(deps.config, query.from.id) && !PUBLIC_COMMANDS.has(data)) {
    await deps.telegram.answerCallback(query.id, "Not allowed");
    return;
  }

  if (data.startsWith("k:")) {
    const [, draftId, tagRaw] = data.split(":");
    const tag: ChildTag = tagRaw === "b" ? "both" : tagRaw === "2" ? "2" : "1";
    const draft = await deps.repo.getDraft(draftId);
    if (!draft) {
      await deps.telegram.answerCallback(query.id, "Draft expired");
      return;
    }
    draft.payload = applyChildOverride(draft.payload, tag);
    await deps.repo.saveDraft(draft);
    const children = await deps.repo.listChildren();
    await deps.telegram.sendMessage(chatId, formatDraftCard(draft.payload, children), {
      replyMarkup: draftKeyboard(draft.id),
    });
    await deps.telegram.answerCallback(query.id, tag === "both" ? "Both kids" : `豬${tag}`);
    return;
  }

  if (data.startsWith("s:")) {
    const draftId = data.slice(2);
    const draft = await deps.repo.getDraft(draftId);
    if (!draft) {
      await deps.telegram.answerCallback(query.id, "Draft expired");
      return;
    }
    const organisations = await deps.repo.listOrganisations();
    const saved = await persistDraft(
      deps.repo,
      draft.payload,
      draft.senderTelegramId,
      deps.clock().toISOString(),
      organisations,
    );
    await deps.repo.deleteDraft(draftId);
    await deps.telegram.sendMessage(
      chatId,
      `Saved ${saved.eventCount} event(s) and ${saved.taskCount} task(s). Ask me “tomorrow?” or use /tomorrow.`,
    );
    await deps.telegram.answerCallback(query.id, "Saved");
    return;
  }

  if (data.startsWith("x:")) {
    await deps.repo.deleteDraft(data.slice(2));
    await deps.telegram.sendMessage(chatId, "Discarded. Nothing was saved.");
    await deps.telegram.answerCallback(query.id, "Discarded");
    return;
  }

  if (data.startsWith("t:")) {
    const task = await deps.repo.markTaskDone(Number(data.slice(2)));
    await deps.telegram.sendMessage(chatId, task ? `Done: ${task.title}` : "Task not found");
    await deps.telegram.answerCallback(query.id, "Done");
    return;
  }

  if (data.startsWith("as:")) {
    const pending = await deps.repo.getPending(query.from.id);
    if (!pending || pending.kind !== "addschool_type") {
      await deps.telegram.answerCallback(query.id, "No pending school");
      return;
    }
    const orgType = data.slice(3) as OrgType;
    await deps.repo.setPending({
      ...pending,
      kind: "addschool_kids",
      orgType,
    });
    await deps.telegram.sendMessage(chatId, `Link “${pending.name}” to which child?`, {
      replyMarkup: addSchoolKidsKeyboard(),
    });
    await deps.telegram.answerCallback(query.id, orgType);
    return;
  }

  if (data.startsWith("ak:")) {
    const pending = await deps.repo.getPending(query.from.id);
    if (!pending || pending.kind !== "addschool_kids" || !pending.orgType) {
      await deps.telegram.answerCallback(query.id, "No pending school");
      return;
    }
    const org = await deps.repo.addOrganisation(pending.name, pending.orgType);
    const tag = data.slice(3);
    const childIds = tag === "b" ? [1, 2] : [Number(tag)];
    for (const childId of childIds) {
      await deps.repo.linkChildOrganisation(childId, org.id);
    }
    await deps.repo.clearPending(query.from.id);
    await deps.telegram.sendMessage(chatId, `Added ${org.type} “${org.name}” (id ${org.id}).`);
    await deps.telegram.answerCallback(query.id, "Added");
    return;
  }

  await deps.telegram.answerCallback(query.id);
}

async function ingestMedia(
  deps: BotDeps,
  message: TelegramMessage,
  senderId: number,
  chatId: number,
  caption: string,
): Promise<void> {
  await deps.telegram.sendMessage(chatId, "Reading the notice…");
  let imageBase64: string | undefined;
  let mimeType: string | undefined;
  let fileKey: string | null = null;
  let source = caption && !message.photo && !message.document ? "text" : "telegram";

  try {
    if (message.photo?.length) {
      const photo = message.photo[message.photo.length - 1];
      const file = await deps.telegram.downloadFile(photo.file_id);
      imageBase64 = bytesToBase64(file.bytes);
      mimeType = file.mimeType.startsWith("image/") ? file.mimeType : "image/jpeg";
      source = "photo";
      fileKey = await storeFile(deps, file.bytes, mimeType, "jpg");
    } else if (message.document) {
      const file = await deps.telegram.downloadFile(message.document.file_id);
      mimeType = message.document.mime_type || file.mimeType;
      source = mimeType.includes("pdf") ? "pdf" : "telegram";
      const canSendToGemini =
        mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType.startsWith("text/");
      if (canSendToGemini && !mimeType.startsWith("text/")) {
        imageBase64 = bytesToBase64(file.bytes);
      }
      if (mimeType.startsWith("text/")) {
        caption = `${caption}\n${new TextDecoder().decode(file.bytes)}`.trim();
      }
      fileKey = await storeFile(deps, file.bytes, mimeType, message.document.file_name || "notice");
    }
  } catch (error) {
    await deps.telegram.sendMessage(chatId, `Could not download the file: ${errorMessage(error)}`);
    return;
  }

  if (!imageBase64 && !caption) {
    await deps.telegram.sendMessage(chatId, "Please send a photo, PDF, or the notice as text.");
    return;
  }

  const [children, organisations] = await Promise.all([deps.repo.listChildren(), deps.repo.listOrganisations()]);
  let extracted;
  try {
    extracted = await deps.gemini.extract({
      text: caption || undefined,
      imageBase64,
      mimeType,
      children,
      organisations,
    });
  } catch (error) {
    await deps.telegram.sendMessage(
      chatId,
      `I could not read that notice (${errorMessage(error)}). Try a clearer photo or paste the text.`,
    );
    return;
  }

  const draftId = shortId();
  const createdAt = deps.clock().toISOString();
  await deps.repo.saveDraft({
    id: draftId,
    senderTelegramId: senderId,
    chatId,
    createdAt,
    payload: {
      source,
      rawText: extracted.rawText || caption,
      fileKey,
      events: extracted.events,
      summary: extracted.summary,
      childOverride: null,
    },
  });
  await deps.telegram.sendMessage(chatId, formatDraftCard(
    {
      source,
      rawText: extracted.rawText || caption,
      fileKey,
      events: extracted.events,
      summary: extracted.summary,
      childOverride: null,
    },
    children,
  ), { replyMarkup: draftKeyboard(draftId) });
}

async function storeFile(deps: BotDeps, bytes: Uint8Array, mimeType: string, hint: string): Promise<string | null> {
  if (!deps.files) return null;
  const key = `notices/${deps.clock().toISOString().slice(0, 10)}/${shortId()}-${hint}`.replace(/\s+/g, "-");
  return deps.files.put(key, bytes, mimeType);
}

async function sendAgenda(deps: BotDeps, chatId: number, which: "today" | "tomorrow" | "week", role: Role): Promise<void> {
  const range = todayAndRange(deps.clock(), deps.config.timezone);
  const children = await deps.repo.listChildren();
  if (which === "week") {
    const { items } = await collectAgenda(deps.repo, range.today, addDays(range.today, 6));
    await deps.telegram.sendMessage(chatId, formatWeekList(items, children));
    return;
  }
  const ymd = which === "today" ? range.today : range.tomorrow;
  const { items, tasks } = await collectAgenda(deps.repo, ymd, ymd);
  const audience = role === "helper" ? "helper" : "parent";
  await deps.telegram.sendMessage(
    chatId,
    formatAgenda(
      which === "today" ? `Today ${ymd}` : `Tomorrow ${ymd}`,
      itemsOnDay(items, ymd),
      tasksRelevantToDay(tasks, ymd),
      children,
      audience,
    ),
  );
}

async function sendSlips(deps: BotDeps, chatId: number): Promise<void> {
  const tasks = await deps.repo.listOpenTasks();
  if (!tasks.length) {
    await deps.telegram.sendMessage(chatId, "No open reply slips or tasks.");
    return;
  }
  for (const task of tasks) {
    const due = task.dueAt ? ` (due ${task.dueAt.slice(0, 10)})` : "";
    await deps.telegram.sendMessage(chatId, `• ${task.title}${due}`, { replyMarkup: taskDoneKeyboard(task.id) });
  }
}

async function answerQuestion(deps: BotDeps, chatId: number, text: string, role: Role): Promise<void> {
  const kind = looksLikeAgendaQuery(text);
  if (kind === "today" || kind === "tomorrow" || kind === "week") {
    await sendAgenda(deps, chatId, kind, role);
    return;
  }
  if (kind === "slips") {
    await sendSlips(deps, chatId);
    return;
  }

  const range = todayAndRange(deps.clock(), deps.config.timezone);
  const children = await deps.repo.listChildren();
  const { items, events, tasks } = await collectAgenda(deps.repo, range.today, addDays(range.today, 21));
  const snippets = [
    ...events.map((event) => event.notes).filter((note): note is string => Boolean(note)),
    ...(await noticeTextsForEvents(deps.repo, events)),
  ];
  try {
    const answer = await deps.gemini.answer(text, items, tasks, children, snippets);
    await deps.telegram.sendMessage(chatId, answer);
  } catch (error) {
    console.error("Q&A failed:", errorMessage(error));
    await deps.telegram.sendMessage(chatId, answerFromCalendar(text, items, tasks, children));
  }
}

export async function handleScheduled(deps: BotDeps, cron: string): Promise<void> {
  const kind = reminderKindFromCron(cron);
  if (!kind) return;
  const now = deps.clock();
  const key = reminderLogKey(kind, now, deps.config.timezone);
  if (await deps.repo.hasReminder(key.kind, key.sentOn)) return;
  const body = await buildReminderMessage(deps.repo, kind, now, deps.config.timezone);
  const recipients =
    kind === "helper_morning" ? deps.config.helperIds : [...new Set([...deps.config.adminIds, ...deps.config.parentIds])];
  for (const chatId of recipients) {
    await deps.telegram.sendMessage(chatId, body);
  }
  await deps.repo.logReminder(key.kind, key.sentOn, now.toISOString());
}

async function noticeTextsForEvents(repo: FamilyRepo, events: import("./types.js").CalendarEvent[]): Promise<string[]> {
  const ids = [...new Set(events.map((event) => event.noticeId).filter((id): id is number => id != null))];
  const texts: string[] = [];
  for (const id of ids) {
    const notice = await repo.getNotice(id);
    if (notice?.rawText) texts.push(notice.rawText.slice(0, 1200));
  }
  return texts;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
