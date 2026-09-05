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
import { eventInRange } from "./time.js";

export class MemoryRepo implements FamilyRepo {
  children: Child[] = [];
  organisations: Organisation[] = [];
  childOrgs: Array<{ childId: number; organisationId: number }> = [];
  users: FamilyUser[] = [];
  notices: Notice[] = [];
  events: CalendarEvent[] = [];
  tasks: Task[] = [];
  timetable: TimetableSlot[] = [];
  drafts = new Map<string, Draft>();
  pending = new Map<number, PendingAction>();
  reminders: Array<{ kind: string; sentOn: string; createdAt: string }> = [];

  private ids = { child: 1, org: 1, user: 1, notice: 1, event: 1, task: 1, slot: 1 };

  seedDemoFamily(): void {
    this.children = [
      { id: 1, name: "豬1", nickname: "Pig1", grade: null },
      { id: 2, name: "豬2", nickname: "Pig2", grade: null },
    ];
    this.organisations = [
      { id: 1, name: "學校 A", type: "school", notes: null },
      { id: 2, name: "學校 B", type: "school", notes: null },
      { id: 3, name: "學校 C", type: "school", notes: null },
      { id: 4, name: "數學補習", type: "tutorial", notes: null },
      { id: 5, name: "英文補習", type: "tutorial", notes: null },
      { id: 6, name: "鋼琴", type: "tutorial", notes: null },
    ];
    this.childOrgs = [
      { childId: 1, organisationId: 1 },
      { childId: 1, organisationId: 2 },
      { childId: 1, organisationId: 4 },
      { childId: 1, organisationId: 6 },
      { childId: 2, organisationId: 1 },
      { childId: 2, organisationId: 3 },
      { childId: 2, organisationId: 5 },
    ];
    this.timetable = [
      {
        id: 1,
        childId: 1,
        organisationId: 4,
        title: "數學補習",
        weekday: 1,
        startTime: "16:30",
        endTime: "18:00",
        location: "數學補習",
        itemsToBring: ["功課冊"],
        notes: null,
      },
      {
        id: 2,
        childId: 2,
        organisationId: 5,
        title: "英文補習",
        weekday: 3,
        startTime: "16:30",
        endTime: "18:00",
        location: "英文補習",
        itemsToBring: ["英文書"],
        notes: null,
      },
      {
        id: 3,
        childId: 1,
        organisationId: 1,
        title: "PE / 體育",
        weekday: 5,
        startTime: "08:00",
        endTime: "09:00",
        location: "學校 A",
        itemsToBring: ["白鞋", "水"],
        notes: "Regular PE day",
      },
    ];
    this.ids = { child: 3, org: 7, user: 1, notice: 1, event: 1, task: 1, slot: 4 };
  }

  async listChildren(): Promise<Child[]> {
    return [...this.children];
  }

  async getChild(id: number): Promise<Child | null> {
    return this.children.find((child) => child.id === id) ?? null;
  }

  async listOrganisations(): Promise<Organisation[]> {
    return [...this.organisations];
  }

  async addOrganisation(name: string, type: OrgType, notes?: string | null): Promise<Organisation> {
    const org: Organisation = { id: this.ids.org++, name, type, notes: notes ?? null };
    this.organisations.push(org);
    return org;
  }

  async linkChildOrganisation(childId: number, organisationId: number): Promise<void> {
    if (!this.childOrgs.some((row) => row.childId === childId && row.organisationId === organisationId)) {
      this.childOrgs.push({ childId, organisationId });
    }
  }

  async listUsers(): Promise<FamilyUser[]> {
    return [...this.users];
  }

  async upsertUser(telegramId: number, displayName: string, role: Role): Promise<FamilyUser> {
    const existing = this.users.find((user) => user.telegramId === telegramId);
    if (existing) {
      existing.displayName = displayName;
      existing.role = role;
      return existing;
    }
    const user: FamilyUser = { id: this.ids.user++, telegramId, displayName, role };
    this.users.push(user);
    return user;
  }

  async createNotice(input: {
    source: string;
    rawText: string | null;
    fileKey: string | null;
    senderTelegramId: number | null;
    createdAt: string;
  }): Promise<Notice> {
    const notice: Notice = { id: this.ids.notice++, ...input };
    this.notices.push(notice);
    return notice;
  }

  async getNotice(id: number): Promise<Notice | null> {
    return this.notices.find((notice) => notice.id === id) ?? null;
  }

  async createEvent(input: NewEventInput, createdAt: string): Promise<CalendarEvent> {
    const event: CalendarEvent = {
      id: this.ids.event++,
      noticeId: input.noticeId,
      organisationId: input.organisationId,
      title: input.title,
      startAt: input.startAt,
      endAt: input.endAt,
      location: input.location,
      type: input.type,
      itemsToBring: [...input.itemsToBring],
      uniform: input.uniform,
      notes: input.notes,
      createdAt,
      childIds: [...input.childIds],
    };
    this.events.push(event);
    return event;
  }

  async listEventsBetween(fromYmd: string, toYmd: string): Promise<CalendarEvent[]> {
    return this.events.filter((event) => eventInRange(event.startAt, fromYmd, toYmd));
  }

  async createTask(input: NewTaskInput, createdAt: string): Promise<Task> {
    const task: Task = {
      id: this.ids.task++,
      eventId: input.eventId,
      title: input.title,
      dueAt: input.dueAt,
      assigneeRole: input.assigneeRole,
      status: "open",
      createdAt,
    };
    this.tasks.push(task);
    return task;
  }

  async listOpenTasks(): Promise<Task[]> {
    return this.tasks.filter((task) => task.status === "open");
  }

  async markTaskDone(id: number): Promise<Task | null> {
    const task = this.tasks.find((item) => item.id === id);
    if (!task) return null;
    task.status = "done";
    return task;
  }

  async listTimetable(): Promise<TimetableSlot[]> {
    return [...this.timetable];
  }

  async addTimetableSlot(slot: Omit<TimetableSlot, "id">): Promise<TimetableSlot> {
    const saved: TimetableSlot = { id: this.ids.slot++, ...slot };
    this.timetable.push(saved);
    return saved;
  }

  async saveDraft(draft: Draft): Promise<void> {
    this.drafts.set(draft.id, structuredClone(draft));
  }

  async getDraft(id: string): Promise<Draft | null> {
    const draft = this.drafts.get(id);
    return draft ? structuredClone(draft) : null;
  }

  async deleteDraft(id: string): Promise<void> {
    this.drafts.delete(id);
  }

  async setPending(action: PendingAction): Promise<void> {
    this.pending.set(action.telegramId, { ...action });
  }

  async getPending(telegramId: number): Promise<PendingAction | null> {
    return this.pending.get(telegramId) ?? null;
  }

  async clearPending(telegramId: number): Promise<void> {
    this.pending.delete(telegramId);
  }

  async hasReminder(kind: string, sentOn: string): Promise<boolean> {
    return this.reminders.some((row) => row.kind === kind && row.sentOn === sentOn);
  }

  async logReminder(kind: string, sentOn: string, createdAt: string): Promise<void> {
    this.reminders.push({ kind, sentOn, createdAt });
  }
}
