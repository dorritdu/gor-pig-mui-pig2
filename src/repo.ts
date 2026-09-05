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

export interface FamilyRepo {
  listChildren(): Promise<Child[]>;
  getChild(id: number): Promise<Child | null>;
  listOrganisations(): Promise<Organisation[]>;
  addOrganisation(name: string, type: OrgType, notes?: string | null): Promise<Organisation>;
  linkChildOrganisation(childId: number, organisationId: number): Promise<void>;
  listUsers(): Promise<FamilyUser[]>;
  upsertUser(telegramId: number, displayName: string, role: Role): Promise<FamilyUser>;
  createNotice(input: {
    source: string;
    rawText: string | null;
    fileKey: string | null;
    senderTelegramId: number | null;
    createdAt: string;
  }): Promise<Notice>;
  getNotice(id: number): Promise<Notice | null>;
  createEvent(input: NewEventInput, createdAt: string): Promise<CalendarEvent>;
  listEventsBetween(fromYmd: string, toYmd: string): Promise<CalendarEvent[]>;
  createTask(input: NewTaskInput, createdAt: string): Promise<Task>;
  listOpenTasks(): Promise<Task[]>;
  markTaskDone(id: number): Promise<Task | null>;
  listTimetable(): Promise<TimetableSlot[]>;
  addTimetableSlot(slot: Omit<TimetableSlot, "id">): Promise<TimetableSlot>;
  saveDraft(draft: Draft): Promise<void>;
  getDraft(id: string): Promise<Draft | null>;
  deleteDraft(id: string): Promise<void>;
  setPending(action: PendingAction): Promise<void>;
  getPending(telegramId: number): Promise<PendingAction | null>;
  clearPending(telegramId: number): Promise<void>;
  hasReminder(kind: string, sentOn: string): Promise<boolean>;
  logReminder(kind: string, sentOn: string, createdAt: string): Promise<void>;
}
