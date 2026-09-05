import type { Child, EventType, ExtractedEvent, ExtractResult, Organisation, Role } from "./types.js";
import { EVENT_TYPES } from "./types.js";

const EVENT_TYPE_SET = new Set<string>(EVENT_TYPES);

export function buildExtractPrompt(children: Child[], organisations: Organisation[]): string {
  const kidLines = children.map((child) => `- id ${child.id}: ${child.name} / ${child.nickname}`).join("\n");
  const orgLines = organisations.map((org) => `- ${org.name} (${org.type})`).join("\n");
  return `You extract school and tutorial notices for a Hong Kong family.
Kids:
${kidLines}
Organisations:
${orgLines}

Return ONLY JSON with this shape:
{
  "summary": "one short bilingual sentence",
  "rawText": "visible text from the notice",
  "events": [
    {
      "title": "string",
      "childGuess": "pig1" | "pig2" | "both" | "unknown",
      "organisationGuess": "string or null",
      "startDate": "YYYY-MM-DD or null",
      "startTime": "HH:MM or null",
      "endDate": "YYYY-MM-DD or null",
      "endTime": "HH:MM or null",
      "location": "string or null",
      "type": "activity|exam|holiday|tutorial|trip|deadline|payment",
      "itemsToBring": ["string"],
      "uniform": "string or null",
      "notes": "string or null",
      "tasks": [
        { "title": "sign reply slip / pay $120", "dueDate": "YYYY-MM-DD or null", "assigneeRole": "parent|helper|null" }
      ]
    }
  ]
}

Rules:
- Dates are Hong Kong local dates. Convert 21/3, 21 Mar, 三月二十一 to YYYY-MM-DD. If year is missing, use the most likely upcoming year.
- Prefer Traditional Chinese titles when the notice is Chinese; keep English names too in notes if mixed.
- Reply slips, payments, and signatures become tasks with assigneeRole "parent".
- Items to bring (shoes, water, costume, form) go in itemsToBring.
- If the page is not a school/tutorial notice, return events: [].
- Do not invent dates that are not in the notice.`;
}

export function parseExtractJson(text: string): ExtractResult {
  const json = extractJsonObject(text);
  const eventsRaw = Array.isArray(json.events) ? json.events : [];
  const events = eventsRaw.map(normalizeEvent).filter((event): event is ExtractedEvent => Boolean(event));
  return {
    events,
    summary: typeof json.summary === "string" ? json.summary : events[0]?.title ?? "Notice",
    rawText: typeof json.rawText === "string" ? json.rawText : "",
  };
}

export function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("Gemini did not return JSON");
  }
  return JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
}

function normalizeEvent(raw: unknown): ExtractedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!title) return null;
  return {
    title,
    childGuess: normalizeGuess(row.childGuess),
    organisationGuess: stringOrNull(row.organisationGuess),
    startDate: stringOrNull(row.startDate),
    startTime: stringOrNull(row.startTime),
    endDate: stringOrNull(row.endDate),
    endTime: stringOrNull(row.endTime),
    location: stringOrNull(row.location),
    type: normalizeType(row.type),
    itemsToBring: stringArray(row.itemsToBring),
    uniform: stringOrNull(row.uniform),
    notes: stringOrNull(row.notes),
    tasks: taskArray(row.tasks),
  };
}

function normalizeGuess(value: unknown): ExtractedEvent["childGuess"] {
  const text = String(value ?? "unknown").toLowerCase();
  if (text.includes("both") || text.includes("all")) return "both";
  if (text.includes("pig1") || text.includes("豬1") || text === "1") return "pig1";
  if (text.includes("pig2") || text.includes("豬2") || text === "2") return "pig2";
  return "unknown";
}

function normalizeType(value: unknown): EventType {
  const text = String(value ?? "activity").toLowerCase();
  return EVENT_TYPE_SET.has(text) ? (text as EventType) : "activity";
}

function stringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text === "null") return null;
  return text;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function taskArray(value: unknown): ExtractedEvent["tasks"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const title = typeof row.title === "string" ? row.title.trim() : "";
      if (!title) return null;
      const role = String(row.assigneeRole ?? "").toLowerCase();
      const assigneeRole: Role | null = role === "parent" || role === "helper" || role === "admin" ? role : null;
      return { title, dueDate: stringOrNull(row.dueDate), assigneeRole };
    })
    .filter((task): task is ExtractedEvent["tasks"][number] => Boolean(task));
}

export function matchOrganisation(name: string | null, organisations: Organisation[]): number | null {
  if (!name) return null;
  const needle = name.toLowerCase();
  const exact = organisations.find((org) => org.name.toLowerCase() === needle);
  if (exact) return exact.id;
  const partial = organisations.find(
    (org) => org.name.toLowerCase().includes(needle) || needle.includes(org.name.toLowerCase()),
  );
  return partial?.id ?? null;
}
