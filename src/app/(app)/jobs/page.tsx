import { Briefcase, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { countJobs, listJobs } from "@/data/jobs";
import { requireUser } from "@/lib/auth/session";
import { fitWarnings } from "@/lib/domain/fit";
import { isStage } from "@/lib/domain/stages";
import { pluralize } from "@/lib/format";
import { AddJobButton } from "@/components/jobs/add-job-button";
import { JobBoard } from "@/components/jobs/job-board";
import { JobList } from "@/components/jobs/job-list";
import { JobsToolbar } from "@/components/jobs/jobs-toolbar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Jobs" };

const SORTS = ["updated", "company", "excitement", "applied"] as const;
type Sort = (typeof SORTS)[number];

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const user = await requireUser();
  const params = await searchParams;
  const view = params.view === "list" ? "list" : "board";
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const stage = isStage(params.stage) ? params.stage : undefined;
  const sort: Sort = SORTS.includes(params.sort as Sort) ? (params.sort as Sort) : "updated";

  const [jobs, total] = await Promise.all([
    listJobs(user.id, {
      query,
      stages: view === "list" && stage ? [stage] : undefined,
      sort: view === "list" ? sort : "updated",
      // The board only shows recently closed jobs; the list shows everything.
      closedWithinDays: view === "board" ? 30 : undefined,
    }),
    countJobs(user.id),
  ]);
  const withWarnings = jobs.map((j) => ({ ...j, warnings: j.stage === "closed" ? [] : fitWarnings(j, user) }));
  const firstBusy = (["applied", "interviewing", "offer", "saved"] as const).find((s) => jobs.some((j) => j.stage === s));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Jobs</h1>
        <p className="mt-1 text-ink-2">{total === 0 ? "Everything you’re tracking lives here." : `${pluralize(total, "job")} tracked`}</p>
      </header>

      {total === 0 ? (
        <EmptyState
          icon={<Briefcase />}
          title="Nothing tracked yet"
          body="Add a job you’re eyeing — even one you haven’t applied to. Paste its link and Jobbier fills in the rest."
          action={<AddJobButton />}
        />
      ) : (
        <>
          <Suspense>
            <JobsToolbar view={view} />
          </Suspense>
          {jobs.length === 0 ? (
            <EmptyState
              icon={<SearchX />}
              title={query ? `Nothing matches “${query}”` : "No jobs in this stage"}
              body={query ? "Try the company name, the role, or a city." : "Pick another stage, or show them all."}
              action={
                <ButtonLink href={view === "list" ? "/jobs?view=list" : "/jobs"} size="sm">
                  Show all jobs
                </ButtonLink>
              }
            />
          ) : view === "board" ? (
            <JobBoard jobs={withWarnings} timeZone={user.timeZone} initialStage={stage ?? firstBusy} />
          ) : (
            <JobList jobs={withWarnings} timeZone={user.timeZone} />
          )}
          {view === "board" ? <p className="text-xs text-ink-3">The board shows jobs closed in the last 30 days. Switch to the list to see everything.</p> : null}
        </>
      )}
    </div>
  );
}
