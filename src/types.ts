export type Role = "admin" | "parent" | "helper";
export type OrgType = "school" | "tutorial";
export type EventType =
  | "activity"
  | "exam"
  | "holiday"
  | "tutorial"
  | "trip"
  | "deadline"
  | "payment";
export type TaskStatus = "open" | "done";
export type ChildTag = "1" | "2" | "both";

export interface Child {
  id: number;
  name: string;
  nickname: string;
  grade: string | null;
}

export interface Organisation {
  id: number;
  name: string;
  type: OrgType;
  notes: string | null;
}

export interface FamilyUser {
  id: number;
  telegramId: number;
  displayName: string;
  role: Role;
}

export interface Notice {
  id: number;
  source: string;
  rawText: string | null;
  fileKey: string | null;
  senderTelegramId: number | null;
  createdAt: string;
}

export interface CalendarEvent {
  id: number;
  noticeId: number | null;
  organisationId: number | null;
  title: string;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  type: EventType;
  itemsToBring: string[];
  uniform: string | null;
  notes: string | null;
  createdAt: string;
  childIds: number[];
}

export interface Task {
  id: number;
  eventId: number | null;
  title: string;
  dueAt: string | null;
  assigneeRole: Role | null;
  status: TaskStatus;
  createdAt: string;
}

export interface TimetableSlot {
  id: number;
  childId: number;
  organisationId: number | null;
  title: string;
  weekday: number;
  startTime: string;
  endTime: string | null;
  location: string | null;
  itemsToBring: string[];
  notes: string | null;
}

export interface ExtractedTask {
  title: string;
  dueDate: string | null;
  assigneeRole: Role | null;
}

export interface ExtractedEvent {
  title: string;
  childGuess: "pig1" | "pig2" | "both" | "unknown";
  organisationGuess: string | null;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  location: string | null;
  type: EventType;
  itemsToBring: string[];
  uniform: string | null;
  notes: string | null;
  tasks: ExtractedTask[];
}

export interface ExtractResult {
  events: ExtractedEvent[];
  summary: string;
  rawText: string;
}

export interface DraftPayload {
  source: string;
  rawText: string;
  fileKey: string | null;
  events: ExtractedEvent[];
  summary: string;
  childOverride: ChildTag | null;
}

export interface Draft {
  id: string;
  senderTelegramId: number;
  chatId: number;
  payload: DraftPayload;
  createdAt: string;
}

export interface PendingAction {
  telegramId: number;
  kind: "addschool_type" | "addschool_kids";
  name: string;
  orgType?: OrgType;
  createdAt: string;
}

export interface NewEventInput {
  noticeId: number | null;
  organisationId: number | null;
  title: string;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  type: EventType;
  itemsToBring: string[];
  uniform: string | null;
  notes: string | null;
  childIds: number[];
}

export interface NewTaskInput {
  eventId: number | null;
  title: string;
  dueAt: string | null;
  assigneeRole: Role | null;
}

export interface AppConfig {
  timezone: string;
  adminIds: number[];
  parentIds: number[];
  helperIds: number[];
}

export const EVENT_TYPES: EventType[] = [
  "activity",
  "exam",
  "holiday",
  "tutorial",
  "trip",
  "deadline",
  "payment",
];
