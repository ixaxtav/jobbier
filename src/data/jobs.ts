import "server-only";
import { and, asc, desc, eq, gt, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, contacts, documents, events, jobDocuments, jobs, type Job, type Outcome, type Stage } from "@/db/schema";
import { applyStageChange } from "@/lib/domain/stages";
import type { JobInput } from "@/lib/validation";

export class NotFoundError extends Error {}

/** Every read and write is scoped by userId — there is no unscoped job query in the app. */
async function ownedJob(userId: string, jobId: string) {
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))).limit(1);
  if (!job) throw new NotFoundError("Job not found");
  return job;
}

export async function getJob(userId: string, jobId: string) {
  return ownedJob(userId, jobId).catch((e) => (e instanceof NotFoundError ? null : Promise.reject(e)));
}

export type JobListItem = Job & { nextEventAt: Date | null; nextEventTitle: string | null };

type ListOptions = {
  query?: string;
  stages?: Stage[];
  sort?: "updated" | "company" | "excitement" | "applied";
  /** Only closed jobs changed in the last N days (keeps the board's closed column short). */
  closedWithinDays?: number;
};

export async function listJobs(userId: string, opts: ListOptions = {}): Promise<JobListItem[]> {
  const nextEvent = db
    .select({
      jobId: events.jobId,
      startsAt: sql<Date>`min(${events.startsAt})`.as("starts_at"),
    })
    .from(events)
    .where(and(eq(events.userId, userId), gt(events.startsAt, new Date())))
    .groupBy(events.jobId)
    .as("next_event");

  const filters = [eq(jobs.userId, userId)];
  if (opts.stages?.length) filters.push(inArray(jobs.stage, opts.stages));
  if (opts.query?.trim()) {
    const q = `%${opts.query.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    filters.push(or(ilike(jobs.company, q), ilike(jobs.title, q), ilike(jobs.location, q))!);
  }
  if (opts.closedWithinDays != null) {
    filters.push(
      or(ne(jobs.stage, "closed"), gt(jobs.stageChangedAt, new Date(Date.now() - opts.closedWithinDays * 86_400_000)))!,
    );
  }

  const order = {
    updated: [desc(jobs.updatedAt)],
    company: [asc(sql`lower(${jobs.company})`), asc(jobs.title)],
    excitement: [sql`${jobs.excitement} desc nulls last`, desc(jobs.updatedAt)],
    applied: [sql`${jobs.appliedAt} desc nulls last`, desc(jobs.updatedAt)],
  }[opts.sort ?? "updated"];

  const rows = await db
    .select({ job: jobs, nextEventAt: nextEvent.startsAt })
    .from(jobs)
    .leftJoin(nextEvent, eq(nextEvent.jobId, jobs.id))
    .where(and(...filters))
    .orderBy(...order);

  // Title of each job's next event, fetched in one go.
  const withEvents = rows.filter((r) => r.nextEventAt).map((r) => r.job.id);
  const titles = new Map<string, string>();
  if (withEvents.length) {
    const upcoming = await db
      .select({ jobId: events.jobId, title: events.title, startsAt: events.startsAt })
      .from(events)
      .where(and(eq(events.userId, userId), inArray(events.jobId, withEvents), gt(events.startsAt, new Date())))
      .orderBy(asc(events.startsAt));
    for (const e of upcoming) if (!titles.has(e.jobId)) titles.set(e.jobId, e.title);
  }

  return rows.map((r) => ({
    ...r.job,
    nextEventAt: r.nextEventAt ? new Date(r.nextEventAt) : null,
    nextEventTitle: titles.get(r.job.id) ?? null,
  }));
}

export async function countJobs(userId: string) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.userId, userId));
  return row.n;
}

/** Everything the job page shows, in parallel. */
export async function getJobDetail(userId: string, jobId: string) {
  const job = await getJob(userId, jobId);
  if (!job) return null;
  const [jobEvents, log, people, attached] = await Promise.all([
    db.select().from(events).where(eq(events.jobId, jobId)).orderBy(asc(events.startsAt)),
    db.select().from(activities).where(eq(activities.jobId, jobId)).orderBy(desc(activities.createdAt)),
    db.select().from(contacts).where(eq(contacts.jobId, jobId)).orderBy(asc(contacts.createdAt)),
    db
      .select({ document: documents, attachedAt: jobDocuments.createdAt })
      .from(jobDocuments)
      .innerJoin(documents, eq(documents.id, jobDocuments.documentId))
      .where(and(eq(jobDocuments.jobId, jobId), eq(documents.userId, userId)))
      .orderBy(asc(jobDocuments.createdAt)),
  ]);
  return { job, events: jobEvents, activities: log, contacts: people, documents: attached };
}

export async function createJob(
  userId: string,
  input: JobInput & { stage?: Exclude<Stage, "closed"> },
  origin?: { leadFrom?: string },
) {
  const now = new Date();
  const stage = input.stage ?? "saved";
  const blank = { stage: "saved" as const, furthestStage: "saved" as const, outcome: null, appliedAt: null };
  // Adding a job straight into "applied" etc. goes through the same rules as moving it there.
  const moved = stage === "saved" ? null : applyStageChange(blank, stage, null, now);
  const stageFields = moved && !("error" in moved) ? moved : { ...blank, stageChangedAt: now };

  return db.transaction(async (tx) => {
    const [job] = await tx
      .insert(jobs)
      .values({ ...input, ...stageFields, userId })
      .returning();
    await tx.insert(activities).values({
      userId,
      jobId: job.id,
      kind: origin?.leadFrom ? "lead" : "created",
      meta: { stage, from: origin?.leadFrom ?? null },
    });
    return job;
  });
}

export async function updateJob(userId: string, jobId: string, input: JobInput) {
  await ownedJob(userId, jobId);
  const [job] = await db
    .update(jobs)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .returning();
  return job;
}

export async function moveJob(userId: string, jobId: string, to: Stage, outcome: Outcome | null) {
  const job = await ownedJob(userId, jobId);
  const change = applyStageChange(job, to, outcome, new Date());
  if ("error" in change) return change;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(jobs)
      // The follow-up is kept on close (it's hidden and ignored while closed) so Undo or Reopen restores it.
      .set({ ...change, updatedAt: change.stageChangedAt })
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
      .returning();
    await tx.insert(activities).values({
      userId,
      jobId,
      kind: "stage",
      meta: { from: job.stage, to, outcome: change.outcome },
    });
    return { job: updated };
  });
}

export async function setNextAction(userId: string, jobId: string, nextAction: string | null, nextActionDue: string | null) {
  await ownedJob(userId, jobId);
  await db
    .update(jobs)
    .set({ nextAction, nextActionDue, updatedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));
}

export async function setExcitement(userId: string, jobId: string, excitement: number | null) {
  await ownedJob(userId, jobId);
  await db.update(jobs).set({ excitement, updatedAt: new Date() }).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));
}

export async function deleteJob(userId: string, jobId: string) {
  await ownedJob(userId, jobId);
  await db.delete(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));
}

/** Touch updatedAt when something inside a job changes (notes, events, people). */
export async function touchJob(userId: string, jobId: string) {
  await db.update(jobs).set({ updatedAt: new Date() }).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));
}

/** Minimal columns for Today's summaries. */
export async function listJobsForSummary(userId: string) {
  return db
    .select({
      id: jobs.id,
      company: jobs.company,
      title: jobs.title,
      stage: jobs.stage,
      furthestStage: jobs.furthestStage,
      outcome: jobs.outcome,
      appliedAt: jobs.appliedAt,
      stageChangedAt: jobs.stageChangedAt,
      nextAction: jobs.nextAction,
      nextActionDue: jobs.nextActionDue,
      excitement: jobs.excitement,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(eq(jobs.userId, userId));
}

export async function findDuplicateByUrl(userId: string, url: string | null) {
  if (!url) return null;
  const [job] = await db
    .select({ id: jobs.id, company: jobs.company, title: jobs.title })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.url, url)))
    .limit(1);
  return job ?? null;
}

