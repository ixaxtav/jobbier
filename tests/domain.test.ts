import { describe, expect, it } from "vitest";
import { needsAttention, type AttentionJob } from "@/lib/domain/attention";
import { applyStageChange } from "@/lib/domain/stages";
import { computeStats } from "@/lib/domain/stats";
import { dayKey, formatDayLabel, utcToZonedLocal, weekStartKey, zonedLocalToUtc } from "@/lib/dates";
import { annualPay, formatPay } from "@/lib/format";
import { fitWarnings } from "@/lib/domain/fit";

const NOW = new Date("2026-09-29T15:00:00Z"); // Tuesday
const TZ = "America/New_York";

describe("applyStageChange", () => {
  const fresh = { stage: "saved" as const, furthestStage: "saved" as const, outcome: null, appliedAt: null };

  it("stamps appliedAt the first time a job leaves saved", () => {
    const next = applyStageChange(fresh, "applied", null, NOW);
    expect(next).toMatchObject({ stage: "applied", furthestStage: "applied", appliedAt: NOW });
  });

  it("keeps the original appliedAt and furthest stage when moving backwards", () => {
    const applied = new Date("2026-09-01T00:00:00Z");
    const next = applyStageChange({ stage: "interviewing", furthestStage: "interviewing", outcome: null, appliedAt: applied }, "applied", null, NOW);
    expect(next).toMatchObject({ stage: "applied", furthestStage: "interviewing", appliedAt: applied });
  });

  it("requires an outcome to close, and only allows one when closing", () => {
    expect(applyStageChange(fresh, "closed", null, NOW)).toHaveProperty("error");
    expect(applyStageChange(fresh, "applied", "hired", NOW)).toHaveProperty("error");
  });

  it("treats hired/declined as having reached an offer", () => {
    expect(applyStageChange(fresh, "closed", "hired", NOW)).toMatchObject({ furthestStage: "offer", outcome: "hired" });
  });

  it("treats a rejection from saved as an application, but not a withdrawal", () => {
    expect(applyStageChange(fresh, "closed", "rejected", NOW)).toMatchObject({ furthestStage: "applied", appliedAt: NOW });
    expect(applyStageChange(fresh, "closed", "withdrew", NOW)).toMatchObject({ furthestStage: "saved", appliedAt: null });
  });

  it("clears the outcome when a closed job is reopened", () => {
    const closed = { stage: "closed" as const, furthestStage: "applied" as const, outcome: "ghosted" as const, appliedAt: NOW };
    expect(applyStageChange(closed, "interviewing", null, NOW)).toMatchObject({ stage: "interviewing", outcome: null });
  });

  it("refuses a no-op move", () => {
    expect(applyStageChange(fresh, "saved", null, NOW)).toHaveProperty("error");
  });
});

describe("needsAttention", () => {
  const job = (over: Partial<AttentionJob>): AttentionJob => ({
    id: over.id ?? "j",
    company: "Acme",
    title: "Engineer",
    stage: "applied",
    stageChangedAt: NOW,
    createdAt: NOW,
    nextAction: null,
    nextActionDue: null,
    excitement: null,
    ...over,
  });
  const ctx = { now: NOW, timeZone: TZ, staleAfterDays: 14, eventsByJob: new Map() };
  const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

  it("flags overdue and due-today follow-ups, most urgent first", () => {
    const items = needsAttention(
      [job({ id: "today", nextAction: "Email Sam", nextActionDue: "2026-09-29" }), job({ id: "late", nextActionDue: "2026-09-26" })],
      ctx,
    );
    expect(items.map((i) => [i.jobId, i.kind])).toEqual([
      ["late", "overdue"],
      ["today", "due-today"],
    ]);
    expect(items[0].detail).toBe("Was due 3 days ago");
    expect(items[1].message).toBe("Email Sam");
  });

  it("nudges stale applications only after the threshold", () => {
    expect(needsAttention([job({ stageChangedAt: daysAgo(13) })], ctx)).toHaveLength(0);
    expect(needsAttention([job({ stageChangedAt: daysAgo(14) })], ctx)[0]).toMatchObject({ kind: "stale", detail: "Applied 14 days ago" });
  });

  it("doesn't nudge when something is scheduled or a follow-up is set in the future", () => {
    const scheduled = new Map([["j", { upcoming: true, lastPast: null }]]);
    expect(needsAttention([job({ stageChangedAt: daysAgo(30) })], { ...ctx, eventsByJob: scheduled })).toHaveLength(0);
    expect(needsAttention([job({ stageChangedAt: daysAgo(30), nextActionDue: "2026-10-05" })], ctx)).toHaveLength(0);
  });

  it("ignores closed jobs and surfaces offers", () => {
    const items = needsAttention([job({ stage: "closed", stageChangedAt: daysAgo(90) }), job({ id: "o", stage: "offer", stageChangedAt: daysAgo(2) })], ctx);
    expect(items).toEqual([expect.objectContaining({ jobId: "o", kind: "offer", detail: "Offer came in 2 days ago" })]);
  });

  it("measures interview quiet time from the last event, not the stage change", () => {
    const events = new Map([["j", { upcoming: false, lastPast: daysAgo(3) }]]);
    expect(needsAttention([job({ stage: "interviewing", stageChangedAt: daysAgo(20) })], { ...ctx, eventsByJob: events })).toHaveLength(0);
    expect(needsAttention([job({ stage: "interviewing", stageChangedAt: daysAgo(20) })], ctx)[0].kind).toBe("quiet");
  });
});

describe("computeStats", () => {
  it("counts stages, weekly applications, and rates", () => {
    const stats = computeStats(
      [
        { stage: "saved", furthestStage: "saved", outcome: null, appliedAt: null },
        { stage: "applied", furthestStage: "applied", outcome: null, appliedAt: new Date("2026-09-28T14:00:00Z") },
        { stage: "interviewing", furthestStage: "interviewing", outcome: null, appliedAt: new Date("2026-09-22T14:00:00Z") },
        { stage: "closed", furthestStage: "interviewing", outcome: "rejected", appliedAt: new Date("2026-09-10T14:00:00Z") },
        { stage: "closed", furthestStage: "applied", outcome: "ghosted", appliedAt: new Date("2026-09-01T14:00:00Z") },
      ],
      NOW,
      TZ,
    );
    expect(stats.byStage).toEqual({ saved: 1, applied: 1, interviewing: 1, offer: 0 });
    expect(stats.closed).toBe(2);
    expect(stats.totalApplied).toBe(4);
    expect(stats.appliedThisWeek).toBe(1);
    expect(stats.appliedLastWeek).toBe(1);
    expect(stats.interviewRate).toBe(0.5);
    expect(stats.responseRate).toBe(0.5);
    expect(stats.weeks).toHaveLength(8);
    expect(stats.weeks.at(-1)).toEqual({ start: "2026-09-28", count: 1 });
  });

  it("returns null rates before any applications", () => {
    const stats = computeStats([], NOW, TZ);
    expect(stats.responseRate).toBeNull();
    expect(stats.weeks.every((w) => w.count === 0)).toBe(true);
  });
});

describe("dates", () => {
  it("reads the calendar day in the user's zone", () => {
    expect(dayKey(new Date("2026-09-30T02:00:00Z"), TZ)).toBe("2026-09-29");
    expect(weekStartKey("2026-10-04")).toBe("2026-09-28"); // Sunday → Monday before
  });

  it("round-trips datetime-local values through a zone, across DST", () => {
    const summer = zonedLocalToUtc("2026-07-01T09:30", TZ)!;
    expect(summer.toISOString()).toBe("2026-07-01T13:30:00.000Z");
    const winter = zonedLocalToUtc("2026-12-01T09:30", TZ)!;
    expect(winter.toISOString()).toBe("2026-12-01T14:30:00.000Z");
    expect(utcToZonedLocal(winter, TZ)).toBe("2026-12-01T09:30");
    expect(zonedLocalToUtc("nope", TZ)).toBeNull();
  });

  it("labels days relative to today", () => {
    expect(formatDayLabel("2026-09-29", "2026-09-29")).toBe("Today");
    expect(formatDayLabel("2026-09-30", "2026-09-29")).toBe("Tomorrow");
    expect(formatDayLabel("2026-10-02", "2026-09-29")).toBe("Friday");
    expect(formatDayLabel("2026-11-12", "2026-09-29")).toBe("Nov 12");
    expect(formatDayLabel("2027-01-03", "2026-09-29")).toBe("Jan 3, 2027");
  });
});

describe("pay", () => {
  it("formats ranges compactly for salaries and exactly for hourly", () => {
    expect(formatPay(120000, 150000, "year")).toBe("$120K–$150K / yr");
    expect(formatPay(28, null, "hour")).toBe("From $28 / hr");
    expect(formatPay(null, 90000, "year")).toBe("Up to $90K / yr");
    expect(formatPay(null, null, "year")).toBeNull();
  });

  it("annualises hourly pay for pay-floor comparisons", () => {
    expect(annualPay(25, 30, "hour")).toBe(62400);
    expect(annualPay(100000, null, "year")).toBe(100000);
  });
});

describe("fitWarnings", () => {
  const prefs = { payFloor: 100000, payFloorPeriod: "year" as const, workModes: ["remote" as const] };

  it("warns when even the top of the range is under the floor", () => {
    expect(fitWarnings({ payMin: 80000, payMax: 95000, payPeriod: "year", workMode: "remote" }, prefs)).toEqual(["Pays below your floor of $100K / yr"]);
    expect(fitWarnings({ payMin: 80000, payMax: 120000, payPeriod: "year", workMode: "remote" }, prefs)).toEqual([]);
  });

  it("compares hourly pay on an annual basis and flags work mode", () => {
    expect(fitWarnings({ payMin: 40, payMax: null, payPeriod: "hour", workMode: "onsite" }, prefs)).toEqual([
      "Pays below your floor of $100K / yr",
      "On-site, but you’re looking for remote",
    ]);
  });

  it("stays quiet without preferences or pay info", () => {
    expect(fitWarnings({ payMin: null, payMax: null, payPeriod: "year", workMode: null }, prefs)).toEqual([]);
    expect(fitWarnings({ payMin: 10, payMax: 10, payPeriod: "hour", workMode: "onsite" }, { payFloor: null, payFloorPeriod: "year", workModes: [] })).toEqual([]);
  });
});
