import "server-only";
import { and, asc, eq, gt, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { activities, contacts, events, jobs, type EventKind } from "@/db/schema";
import { NotFoundError, touchJob } from "./jobs";

async function assertOwnsJob(userId: string, jobId: string) {
  const [row] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))).limit(1);
  if (!row) throw new NotFoundError("Job not found");
}

// ─── Notes (the log) ───────────────────────────────────────────────────────

export async function addNote(userId: string, jobId: string, body: string) {
  await assertOwnsJob(userId, jobId);
  await db.insert(activities).values({ userId, jobId, kind: "note", body });
  await touchJob(userId, jobId);
}

export async function deleteNote(userId: string, activityId: string) {
  // Only notes can be deleted; stage changes are history.
  await db.delete(activities).where(and(eq(activities.id, activityId), eq(activities.userId, userId), eq(activities.kind, "note")));
}

// ─── Events ────────────────────────────────────────────────────────────────

type EventValues = {
  kind: EventKind;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  location: string | null;
  notes: string | null;
};

export async function addEvent(userId: string, jobId: string, values: EventValues) {
  await assertOwnsJob(userId, jobId);
  const [event] = await db.insert(events).values({ ...values, userId, jobId }).returning();
  await db.insert(activities).values({ userId, jobId, kind: "event", meta: { title: values.title, kind: values.kind, startsAt: values.startsAt.toISOString() } });
  await touchJob(userId, jobId);
  return event;
}

export async function updateEvent(userId: string, eventId: string, values: EventValues) {
  const [event] = await db
    .update(events)
    .set(values)
    .where(and(eq(events.id, eventId), eq(events.userId, userId)))
    .returning();
  if (!event) throw new NotFoundError("Event not found");
  await touchJob(userId, event.jobId);
  return event;
}

export async function deleteEvent(userId: string, eventId: string) {
  await db.delete(events).where(and(eq(events.id, eventId), eq(events.userId, userId)));
}

export async function getEvent(userId: string, eventId: string) {
  const [row] = await db
    .select({ event: events, company: jobs.company, jobTitle: jobs.title })
    .from(events)
    .innerJoin(jobs, eq(jobs.id, events.jobId))
    .where(and(eq(events.id, eventId), eq(events.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Events from `from` onwards (with their job), for Today's agenda. */
export async function listUpcomingEvents(userId: string, from: Date, until: Date) {
  return db
    .select({ event: events, company: jobs.company, jobTitle: jobs.title, stage: jobs.stage })
    .from(events)
    .innerJoin(jobs, eq(jobs.id, events.jobId))
    .where(and(eq(events.userId, userId), gte(events.startsAt, from), lt(events.startsAt, until)))
    .orderBy(asc(events.startsAt));
}

/** Per job: is anything scheduled, and when was the last thing that happened. Feeds the attention rules. */
export async function eventSummaryByJob(userId: string, now: Date) {
  const rows = await db
    .select({ jobId: events.jobId, startsAt: events.startsAt })
    .from(events)
    .where(and(eq(events.userId, userId), gt(events.startsAt, new Date(now.getTime() - 120 * 86_400_000))));
  const map = new Map<string, { upcoming: boolean; lastPast: Date | null }>();
  for (const { jobId, startsAt } of rows) {
    const entry = map.get(jobId) ?? { upcoming: false, lastPast: null };
    if (startsAt > now) entry.upcoming = true;
    else if (!entry.lastPast || startsAt > entry.lastPast) entry.lastPast = startsAt;
    map.set(jobId, entry);
  }
  return map;
}

// ─── People ────────────────────────────────────────────────────────────────

type ContactValues = { name: string; role: string | null; email: string | null; url: string | null; notes: string | null };

export async function addContact(userId: string, jobId: string, values: ContactValues) {
  await assertOwnsJob(userId, jobId);
  await db.insert(contacts).values({ ...values, userId, jobId });
  await touchJob(userId, jobId);
}

export async function updateContact(userId: string, contactId: string, values: ContactValues) {
  const [row] = await db
    .update(contacts)
    .set(values)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)))
    .returning({ jobId: contacts.jobId });
  if (!row) throw new NotFoundError("Contact not found");
}

export async function deleteContact(userId: string, contactId: string) {
  await db.delete(contacts).where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)));
}
