import type { Metadata } from "next";
import Link from "next/link";
import { countJobs, listJobsForSummary } from "@/data/jobs";
import { eventSummaryByJob, listUpcomingEvents } from "@/data/job-details";
import { listDocuments } from "@/data/documents";
import { listIncomingLeads } from "@/data/leads";
import { requireUser } from "@/lib/auth/session";
import { needsAttention } from "@/lib/domain/attention";
import { computeStats } from "@/lib/domain/stats";
import { pluralize } from "@/lib/format";
import { Agenda } from "@/components/today/agenda";
import { AttentionList } from "@/components/today/attention-list";
import { GettingStarted } from "@/components/today/getting-started";
import { SearchLine } from "@/components/today/search-line";
import { WeekStats } from "@/components/today/week-stats";
import { LeadsPreview } from "@/components/leads/leads-preview";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const user = await requireUser();
  const now = new Date();
  const [jobs, eventsByJob, upcoming, leads, files, jobCount] = await Promise.all([
    listJobsForSummary(user.id),
    eventSummaryByJob(user.id, now),
    listUpcomingEvents(user.id, new Date(now.getTime() - 60 * 60_000), new Date(now.getTime() + 14 * 86_400_000)),
    listIncomingLeads(user.id),
    listDocuments(user.id),
    countJobs(user.id),
  ]);

  const attention = needsAttention(jobs, { now, timeZone: user.timeZone, staleAfterDays: user.staleAfterDays, eventsByJob });
  const stats = computeStats(jobs, now, user.timeZone);
  const pendingLeads = leads.filter((l) => l.lead.status === "pending");
  const steps = { hasJob: jobCount > 0, hasPreferences: user.payFloor != null || user.workModes.length > 0, hasFile: files.length > 0 };
  const showGettingStarted = !user.gettingStartedDismissedAt && !(steps.hasJob && steps.hasPreferences && steps.hasFile);
  const firstRun = Boolean((await searchParams).welcome) || jobCount === 0;

  const date = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: user.timeZone }).format(now);
  const headline =
    jobCount === 0
      ? `Hi ${user.name.split(" ")[0]}. Let’s get your search on one line.`
      : attention.length === 0
        ? "You’re all caught up."
        : `${pluralize(attention.length, "thing")} ${attention.length === 1 ? "needs" : "need"} you today.`;

  return (
    <div className="flex flex-col gap-10">
      <header>
        <p className="text-sm text-ink-3">{date}</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{headline}</h1>
      </header>

      {showGettingStarted ? <GettingStarted steps={steps} firstRun={firstRun} /> : null}

      {jobCount > 0 ? (
        <>
          <div className="rounded-lg border border-line bg-surface px-3 pt-5 pb-3 sm:px-6 sm:pt-7">
            <SearchLine stats={stats} />
          </div>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
            <div className="flex min-w-0 flex-col gap-10">
              <section aria-labelledby="needs-heading">
                <h2 id="needs-heading" className="mb-3 text-lg font-semibold">
                  Needs you
                </h2>
                <AttentionList items={attention} />
              </section>
              <section aria-labelledby="agenda-heading">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 id="agenda-heading" className="text-lg font-semibold">
                    Coming up
                  </h2>
                  <span className="text-xs text-ink-3">Next 14 days</span>
                </div>
                <Agenda rows={upcoming} timeZone={user.timeZone} now={now} />
              </section>
            </div>
            <aside className="flex flex-col gap-10">
              {pendingLeads.length > 0 ? <LeadsPreview leads={pendingLeads.slice(0, 3)} total={pendingLeads.length} /> : null}
              <WeekStats stats={stats} />
              <p className="text-xs text-ink-3">
                Applications with no reply after {user.staleAfterDays} days get a nudge.{" "}
                <Link href="/settings#preferences" className="underline underline-offset-2 hover:text-ink">
                  Change
                </Link>
              </p>
            </aside>
          </div>
        </>
      ) : (
        <>
          {pendingLeads.length > 0 ? <LeadsPreview leads={pendingLeads.slice(0, 3)} total={pendingLeads.length} /> : null}
          {/* Show the empty line so the shape of Jobbier is visible before there's any data. */}
          <div className="rounded-lg border border-dashed border-line-strong px-3 pt-5 pb-4 sm:px-6 sm:pt-7">
            <SearchLine stats={stats} />
            <p className="mt-3 text-center text-sm text-ink-3">Every job you add sits on this line, from saved to offer.</p>
          </div>
        </>
      )}
    </div>
  );
}
