import type { Job } from "@/db/schema";
import { dayKey, daysBetweenKeys, daysSince } from "@/lib/dates";
import { pluralize } from "@/lib/format";

export type AttentionJob = Pick<
  Job,
  "id" | "company" | "title" | "stage" | "stageChangedAt" | "nextAction" | "nextActionDue" | "excitement" | "createdAt"
>;

export type AttentionKind = "overdue" | "due-today" | "offer" | "stale" | "quiet" | "excited";

export type AttentionItem = {
  kind: AttentionKind;
  jobId: string;
  company: string;
  title: string;
  message: string;
  detail: string;
};

type Context = {
  now: Date;
  timeZone: string;
  staleAfterDays: number;
  /** Per job: whether it has an event in the future, and when its last past event was. */
  eventsByJob: Map<string, { upcoming: boolean; lastPast: Date | null }>;
};

const ORDER: AttentionKind[] = ["overdue", "due-today", "offer", "stale", "quiet", "excited"];

/**
 * What needs you, most urgent first. This replaces JobCore's "expire shifts"
 * cron: nothing is mutated, staleness is just computed when you look.
 *
 * A job appears at most once. A follow-up you set yourself always wins over
 * an inferred nudge, because it means you've already decided what to do.
 */
export function needsAttention(jobs: AttentionJob[], ctx: Context): AttentionItem[] {
  const today = dayKey(ctx.now, ctx.timeZone);
  const items: AttentionItem[] = [];

  for (const job of jobs) {
    if (job.stage === "closed") continue;
    const base = { jobId: job.id, company: job.company, title: job.title };
    const events = ctx.eventsByJob.get(job.id) ?? { upcoming: false, lastPast: null };

    if (job.nextActionDue) {
      const diff = daysBetweenKeys(today, job.nextActionDue);
      const message = job.nextAction || "Follow up";
      if (diff < 0) {
        items.push({ ...base, kind: "overdue", message, detail: diff === -1 ? "Was due yesterday" : `Was due ${pluralize(-diff, "day")} ago` });
      } else if (diff === 0) {
        items.push({ ...base, kind: "due-today", message, detail: "Due today" });
      }
      // A follow-up is scheduled — no inferred nudges for this job.
      continue;
    }

    const inStage = daysSince(job.stageChangedAt, ctx.now, ctx.timeZone);

    if (job.stage === "offer") {
      items.push({ ...base, kind: "offer", message: "Decide on the offer", detail: inStage === 0 ? "Offer came in today" : `Offer came in ${pluralize(inStage, "day")} ago` });
    } else if (job.stage === "applied" && !events.upcoming && inStage >= ctx.staleAfterDays) {
      items.push({ ...base, kind: "stale", message: "No reply yet — follow up or let it go", detail: `Applied ${pluralize(inStage, "day")} ago` });
    } else if (job.stage === "interviewing" && !events.upcoming) {
      const lastStep = events.lastPast && events.lastPast > job.stageChangedAt ? events.lastPast : job.stageChangedAt;
      const quiet = daysSince(lastStep, ctx.now, ctx.timeZone);
      if (quiet >= Math.ceil(ctx.staleAfterDays / 2)) {
        items.push({ ...base, kind: "quiet", message: "Nothing scheduled — check in", detail: `Quiet for ${pluralize(quiet, "day")}` });
      }
    } else if (job.stage === "saved" && (job.excitement ?? 0) >= 4) {
      const age = daysSince(job.createdAt, ctx.now, ctx.timeZone);
      if (age >= 3) items.push({ ...base, kind: "excited", message: "You’re excited about this one — apply?", detail: `Saved ${pluralize(age, "day")} ago` });
    }
  }

  return items.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}
