import type { FamilyRepo } from "./repo.js";
import { childIdsFromTag } from "./format.js";
import { combineDateTime } from "./time.js";
import { matchOrganisation } from "./extract.js";
import type { ChildTag, DraftPayload, Organisation } from "./types.js";

export async function persistDraft(
  repo: FamilyRepo,
  payload: DraftPayload,
  senderTelegramId: number,
  createdAt: string,
  organisations: Organisation[],
): Promise<{ eventCount: number; taskCount: number }> {
  const notice = await repo.createNotice({
    source: payload.source,
    rawText: payload.rawText || payload.summary,
    fileKey: payload.fileKey,
    senderTelegramId,
    createdAt,
  });

  let eventCount = 0;
  let taskCount = 0;
  for (const extracted of payload.events) {
    const childIds = childIdsFromTag(payload.childOverride, extracted.childGuess);
    const event = await repo.createEvent(
      {
        noticeId: notice.id,
        organisationId: matchOrganisation(extracted.organisationGuess, organisations),
        title: extracted.title,
        startAt: combineDateTime(extracted.startDate, extracted.startTime),
        endAt: combineDateTime(extracted.endDate, extracted.endTime),
        location: extracted.location,
        type: extracted.type,
        itemsToBring: extracted.itemsToBring,
        uniform: extracted.uniform,
        notes: extracted.notes,
        childIds: childIds.length ? childIds : [1, 2],
      },
      createdAt,
    );
    eventCount += 1;
    for (const task of extracted.tasks) {
      await repo.createTask(
        {
          eventId: event.id,
          title: task.title,
          dueAt: task.dueDate ? combineDateTime(task.dueDate, null) : null,
          assigneeRole: task.assigneeRole,
        },
        createdAt,
      );
      taskCount += 1;
    }
  }
  return { eventCount, taskCount };
}

export function applyChildOverride(payload: DraftPayload, tag: ChildTag): DraftPayload {
  return { ...payload, childOverride: tag };
}

export function shortId(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 8);
}
