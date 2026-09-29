import type { Job, Stage } from "@/db/schema";
import { addDaysToKey, dayKey, weekStartKey } from "@/lib/dates";
import { TRACK, trackIndex } from "./stages";

export type StatsJob = Pick<Job, "stage" | "furthestStage" | "outcome" | "appliedAt">;

export type SearchStats = {
  /** Jobs currently sitting at each stop of the line. */
  byStage: Record<(typeof TRACK)[number], number>;
  closed: number;
  hired: number;
  totalApplied: number;
  appliedThisWeek: number;
  appliedLastWeek: number;
  /** Share of applications that got any answer (interview, offer, or rejection). Null until there are applications. */
  responseRate: number | null;
  /** Share of applications that reached an interview. */
  interviewRate: number | null;
  /** Applications per week, oldest first, ending with the current week. */
  weeks: { start: string; count: number }[];
};

export function computeStats(jobs: StatsJob[], now: Date, timeZone: string, weekCount = 8): SearchStats {
  const byStage = { saved: 0, applied: 0, interviewing: 0, offer: 0 };
  let closed = 0;
  let hired = 0;
  let totalApplied = 0;
  let responded = 0;
  let interviewed = 0;

  const thisWeek = weekStartKey(dayKey(now, timeZone));
  const weekStarts = Array.from({ length: weekCount }, (_, i) => addDaysToKey(thisWeek, -7 * (weekCount - 1 - i)));
  const perWeek = new Map(weekStarts.map((w) => [w, 0]));

  for (const job of jobs) {
    if (job.stage === "closed") {
      closed++;
      if (job.outcome === "hired") hired++;
    } else {
      byStage[job.stage as Exclude<Stage, "closed">]++;
    }

    if (!job.appliedAt) continue;
    totalApplied++;
    const reachedInterview = trackIndex(job.furthestStage) >= trackIndex("interviewing");
    if (reachedInterview) interviewed++;
    if (reachedInterview || job.outcome === "rejected") responded++;

    const week = weekStartKey(dayKey(job.appliedAt, timeZone));
    if (perWeek.has(week)) perWeek.set(week, perWeek.get(week)! + 1);
  }

  const rate = (n: number) => (totalApplied === 0 ? null : n / totalApplied);

  return {
    byStage,
    closed,
    hired,
    totalApplied,
    appliedThisWeek: perWeek.get(thisWeek) ?? 0,
    appliedLastWeek: perWeek.get(weekStarts[weekStarts.length - 2]) ?? 0,
    responseRate: rate(responded),
    interviewRate: rate(interviewed),
    weeks: weekStarts.map((start) => ({ start, count: perWeek.get(start)! })),
  };
}
