import type { FamilyRepo } from "./repo.js";
import type {
  CalendarEvent,
  Child,
  Draft,
  FamilyUser,
  NewEventInput,
  NewTaskInput,
  Notice,
  Organisation,
  OrgType,
  PendingAction,
  Role,
  Task,
  TimetableSlot,
} from "./types.js";

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export class D1Repo implements FamilyRepo {
  constructor(private readonly db: D1Database) {}

  async listChildren(): Promise<Child[]> {
    const rows = await this.db.prepare("SELECT * FROM children ORDER BY id").all<Record<string, unknown>>();
    return (rows.results ?? []).map(mapChild);
  }

  async getChild(id: number): Promise<Child | null> {
    const row = await this.db.prepare("SELECT * FROM children WHERE id = ?").bind(id).first<Record<string, unknown>>();
    return row ? mapChild(row) : null;
  }

  async listOrganisations(): Promise<Organisation[]> {
    const rows = await this.db.prepare("SELECT * FROM organisations ORDER BY id").all<Record<string, unknown>>();
    return (rows.results ?? []).map(mapOrg);
  }

  async addOrganisation(name: string, type: OrgType, notes?: string | null): Promise<Organisation> {
    const result = await this.db
      .prepare("INSERT INTO organisations (name, type, notes) VALUES (?, ?, ?)")
      .bind(name, type, notes ?? null)
      .run();
    const id = Number(result.meta.last_row_id);
    return { id, name, type, notes: notes ?? null };
  }

  async linkChildOrganisation(childId: number, organisationId: number): Promise<void> {
    await this.db
      .prepare("INSERT OR IGNORE INTO child_organisations (child_id, organisation_id) VALUES (?, ?)")
      .bind(childId, organisationId)
      .run();
  }

  async listUsers(): Promise<FamilyUser[]> {
    const rows = await this.db.prepare("SELECT * FROM family_users ORDER BY id").all<Record<string, unknown>>();
    return (rows.results ?? []).map(mapUser);
  }

  async upsertUser(telegramId: number, displayName: string, role: Role): Promise<FamilyUser> {
    await this.db
      .prepare(
        `INSERT INTO family_users (telegram_id, display_name, role) VALUES (?, ?, ?)
         ON CONFLICT(telegram_id) DO UPDATE SET display_name = excluded.display_name, role = excluded.role`,
      )
      .bind(telegramId, displayName, role)
      .run();
    const row = await this.db
      .prepare("SELECT * FROM family_users WHERE telegram_id = ?")
      .bind(telegramId)
      .first<Record<string, unknown>>();
    if (!row) throw new Error("upsertUser failed");
    return mapUser(row);
  }

  async createNotice(input: {
    source: string;
    rawText: string | null;
    fileKey: string | null;
    senderTelegramId: number | null;
    createdAt: string;
  }): Promise<Notice> {
    const result = await this.db
      .prepare(
        "INSERT INTO notices (source, raw_text, file_key, sender_telegram_id, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(input.source, input.rawText, input.fileKey, input.senderTelegramId, input.createdAt)
      .run();
    return { id: Number(result.meta.last_row_id), ...input };
  }

  async getNotice(id: number): Promise<Notice | null> {
    const row = await this.db.prepare("SELECT * FROM notices WHERE id = ?").bind(id).first<Record<string, unknown>>();
    return row ? mapNotice(row) : null;
  }

  async createEvent(input: NewEventInput, createdAt: string): Promise<CalendarEvent> {
    const result = await this.db
      .prepare(
        `INSERT INTO events (notice_id, organisation_id, title, start_at, end_at, location, type, items_to_bring, uniform, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.noticeId,
        input.organisationId,
        input.title,
        input.startAt,
        input.endAt,
        input.location,
        input.type,
        JSON.stringify(input.itemsToBring),
        input.uniform,
        input.notes,
        createdAt,
      )
      .run();
    const id = Number(result.meta.last_row_id);
    for (const childId of input.childIds) {
      await this.db
        .prepare("INSERT INTO event_children (event_id, child_id) VALUES (?, ?)")
        .bind(id, childId)
        .run();
    }
    return { id, createdAt, ...input, childIds: [...input.childIds] };
  }

  async listEventsBetween(fromYmd: string, toYmd: string): Promise<CalendarEvent[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM events
         WHERE start_at IS NOT NULL
           AND substr(start_at, 1, 10) >= ?
           AND substr(start_at, 1, 10) <= ?
         ORDER BY start_at`,
      )
      .bind(fromYmd, toYmd)
      .all<Record<string, unknown>>();
    const events: CalendarEvent[] = [];
    for (const row of rows.results ?? []) {
      const childRows = await this.db
        .prepare("SELECT child_id FROM event_children WHERE event_id = ?")
        .bind(row.id)
        .all<{ child_id: number }>();
      events.push({
        ...mapEvent(row),
        childIds: (childRows.results ?? []).map((item) => item.child_id),
      });
    }
    return events;
  }

  async createTask(input: NewTaskInput, createdAt: string): Promise<Task> {
    const result = await this.db
      .prepare("INSERT INTO tasks (event_id, title, due_at, assignee_role, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)")
      .bind(input.eventId, input.title, input.dueAt, input.assigneeRole, createdAt)
      .run();
    return {
      id: Number(result.meta.last_row_id),
      eventId: input.eventId,
      title: input.title,
      dueAt: input.dueAt,
      assigneeRole: input.assigneeRole,
      status: "open",
      createdAt,
    };
  }

  async listOpenTasks(): Promise<Task[]> {
    const rows = await this.db
      .prepare("SELECT * FROM tasks WHERE status = 'open' ORDER BY due_at IS NULL, due_at")
      .all<Record<string, unknown>>();
    return (rows.results ?? []).map(mapTask);
  }

  async markTaskDone(id: number): Promise<Task | null> {
    await this.db.prepare("UPDATE tasks SET status = 'done' WHERE id = ?").bind(id).run();
    const row = await this.db.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first<Record<string, unknown>>();
    return row ? mapTask(row) : null;
  }

  async listTimetable(): Promise<TimetableSlot[]> {
    const rows = await this.db.prepare("SELECT * FROM timetable ORDER BY weekday, start_time").all<Record<string, unknown>>();
    return (rows.results ?? []).map(mapSlot);
  }

  async addTimetableSlot(slot: Omit<TimetableSlot, "id">): Promise<TimetableSlot> {
    const result = await this.db
      .prepare(
        `INSERT INTO timetable (child_id, organisation_id, title, weekday, start_time, end_time, location, items_to_bring, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        slot.childId,
        slot.organisationId,
        slot.title,
        slot.weekday,
        slot.startTime,
        slot.endTime,
        slot.location,
        JSON.stringify(slot.itemsToBring),
        slot.notes,
      )
      .run();
    return { id: Number(result.meta.last_row_id), ...slot };
  }

  async saveDraft(draft: Draft): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO drafts (id, sender_telegram_id, chat_id, payload, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
      )
      .bind(draft.id, draft.senderTelegramId, draft.chatId, JSON.stringify(draft.payload), draft.createdAt)
      .run();
  }

  async getDraft(id: string): Promise<Draft | null> {
    const row = await this.db.prepare("SELECT * FROM drafts WHERE id = ?").bind(id).first<Record<string, unknown>>();
    if (!row) return null;
    return {
      id: String(row.id),
      senderTelegramId: Number(row.sender_telegram_id),
      chatId: Number(row.chat_id),
      payload: JSON.parse(String(row.payload)) as Draft["payload"],
      createdAt: String(row.created_at),
    };
  }

  async deleteDraft(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM drafts WHERE id = ?").bind(id).run();
  }

  async setPending(action: PendingAction): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO pending_actions (telegram_id, payload, created_at) VALUES (?, ?, ?)
         ON CONFLICT(telegram_id) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at`,
      )
      .bind(action.telegramId, JSON.stringify(action), action.createdAt)
      .run();
  }

  async getPending(telegramId: number): Promise<PendingAction | null> {
    const row = await this.db
      .prepare("SELECT payload FROM pending_actions WHERE telegram_id = ?")
      .bind(telegramId)
      .first<{ payload: string }>();
    return row ? (JSON.parse(row.payload) as PendingAction) : null;
  }

  async clearPending(telegramId: number): Promise<void> {
    await this.db.prepare("DELETE FROM pending_actions WHERE telegram_id = ?").bind(telegramId).run();
  }

  async hasReminder(kind: string, sentOn: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT id FROM reminder_logs WHERE kind = ? AND sent_on = ?")
      .bind(kind, sentOn)
      .first();
    return Boolean(row);
  }

  async logReminder(kind: string, sentOn: string, createdAt: string): Promise<void> {
    await this.db
      .prepare("INSERT INTO reminder_logs (kind, sent_on, created_at) VALUES (?, ?, ?)")
      .bind(kind, sentOn, createdAt)
      .run();
  }
}

function mapChild(row: Record<string, unknown>): Child {
  return {
    id: Number(row.id),
    name: String(row.name),
    nickname: String(row.nickname),
    grade: row.grade == null ? null : String(row.grade),
  };
}

function mapOrg(row: Record<string, unknown>): Organisation {
  return {
    id: Number(row.id),
    name: String(row.name),
    type: row.type as OrgType,
    notes: row.notes == null ? null : String(row.notes),
  };
}

function mapUser(row: Record<string, unknown>): FamilyUser {
  return {
    id: Number(row.id),
    telegramId: Number(row.telegram_id),
    displayName: String(row.display_name),
    role: row.role as Role,
  };
}

function mapNotice(row: Record<string, unknown>): Notice {
  return {
    id: Number(row.id),
    source: String(row.source),
    rawText: row.raw_text == null ? null : String(row.raw_text),
    fileKey: row.file_key == null ? null : String(row.file_key),
    senderTelegramId: row.sender_telegram_id == null ? null : Number(row.sender_telegram_id),
    createdAt: String(row.created_at),
  };
}

function mapEvent(row: Record<string, unknown>): CalendarEvent {
  return {
    id: Number(row.id),
    noticeId: row.notice_id == null ? null : Number(row.notice_id),
    organisationId: row.organisation_id == null ? null : Number(row.organisation_id),
    title: String(row.title),
    startAt: row.start_at == null ? null : String(row.start_at),
    endAt: row.end_at == null ? null : String(row.end_at),
    location: row.location == null ? null : String(row.location),
    type: row.type as CalendarEvent["type"],
    itemsToBring: parseJsonArray(row.items_to_bring == null ? null : String(row.items_to_bring)),
    uniform: row.uniform == null ? null : String(row.uniform),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: String(row.created_at),
    childIds: [],
  };
}

function mapTask(row: Record<string, unknown>): Task {
  return {
    id: Number(row.id),
    eventId: row.event_id == null ? null : Number(row.event_id),
    title: String(row.title),
    dueAt: row.due_at == null ? null : String(row.due_at),
    assigneeRole: row.assignee_role == null ? null : (row.assignee_role as Role),
    status: row.status as Task["status"],
    createdAt: String(row.created_at),
  };
}

function mapSlot(row: Record<string, unknown>): TimetableSlot {
  return {
    id: Number(row.id),
    childId: Number(row.child_id),
    organisationId: row.organisation_id == null ? null : Number(row.organisation_id),
    title: String(row.title),
    weekday: Number(row.weekday),
    startTime: String(row.start_time),
    endTime: row.end_time == null ? null : String(row.end_time),
    location: row.location == null ? null : String(row.location),
    itemsToBring: parseJsonArray(row.items_to_bring == null ? null : String(row.items_to_bring)),
    notes: row.notes == null ? null : String(row.notes),
  };
}
