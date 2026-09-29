import { ArrowLeft, ExternalLink, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob, getJobDetail } from "@/data/jobs";
import { listDocuments } from "@/data/documents";
import { listFriends } from "@/data/leads";
import { requireUser } from "@/lib/auth/session";
import { dayKey, formatDayLabel } from "@/lib/dates";
import { fitWarnings } from "@/lib/domain/fit";
import { displayHost, formatPay, WORK_MODE_LABEL } from "@/lib/format";
import { usesBlob } from "@/lib/storage";
import { Monogram } from "@/components/monogram";
import { ActivityLog } from "@/components/job/activity-log";
import { ContactsPanel } from "@/components/job/contacts-panel";
import { EventsPanel } from "@/components/job/events-panel";
import { FilesPanel } from "@/components/job/files-panel";
import { JobActions } from "@/components/job/job-actions";
import { JobInterest } from "@/components/job/job-interest";
import { NextStep } from "@/components/job/next-step";
import { StageTrack } from "@/components/job/stage-track";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const job = UUID.test(id) ? await getJob(user.id, id) : null;
  return { title: job ? `${job.title} at ${job.company}` : "Job not found" };
}

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const [detail, library, friends] = await Promise.all([getJobDetail(user.id, id), listDocuments(user.id), listFriends(user.id)]);
  if (!detail) notFound();

  const { job, events, activities, contacts, documents } = detail;
  const pay = formatPay(job.payMin, job.payMax, job.payPeriod, job.currency);
  const warnings = job.stage === "closed" ? [] : fitWarnings(job, user);
  const today = dayKey(new Date(), user.timeZone);
  const facts = [
    job.location ? { label: "Location", value: job.location } : null,
    job.workMode ? { label: "Setup", value: WORK_MODE_LABEL[job.workMode] } : null,
    pay ? { label: "Pay", value: pay } : null,
    job.source ? { label: "Found via", value: job.source } : null,
    job.appliedAt ? { label: "Applied", value: formatDayLabel(dayKey(job.appliedAt, user.timeZone), today) } : null,
    { label: "Added", value: formatDayLabel(dayKey(job.createdAt, user.timeZone), today) },
  ].filter((f): f is { label: string; value: string } => Boolean(f));

  return (
    <div className="flex flex-col gap-6">
      <Link href="/jobs" className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Jobs
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <Monogram name={job.company} size="lg" className="max-sm:hidden" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">{job.title}</h1>
            <p className="mt-1 text-lg text-ink-2">
              {job.company}
              {job.url ? (
                <>
                  {" "}
                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-1 text-sm text-ink-3 underline decoration-line-strong underline-offset-4 hover:text-ink">
                    {displayHost(job.url) ?? "Posting"}
                    <ExternalLink aria-hidden className="size-3.5" />
                    <span className="sr-only">(opens the posting)</span>
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <JobActions job={job} friends={friends} />
      </header>

      <StageTrack
        key={`${job.stage}-${job.outcome}`}
        jobId={job.id}
        jobLabel={`${job.title} at ${job.company}`}
        initial={{ stage: job.stage, outcome: job.outcome, furthestStage: job.furthestStage }}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-8">
          <NextStep jobId={job.id} stage={job.stage} nextAction={job.nextAction} nextActionDue={job.nextActionDue} timeZone={user.timeZone} />
          <EventsPanel jobId={job.id} company={job.company} events={events} timeZone={user.timeZone} />
          <ActivityLog jobId={job.id} activities={activities} timeZone={user.timeZone} />
        </div>

        <aside className="flex flex-col gap-8">
          <section aria-labelledby="details-heading" className="rounded-lg border border-line bg-surface p-4">
            <h2 id="details-heading" className="sr-only">
              Details
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
              {facts.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="text-ink-3">{f.label}</dt>
                  <dd className="min-w-0 text-right font-medium break-words tabular">{f.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 border-t border-line pt-4">
              <JobInterest jobId={job.id} value={job.excitement} />
            </div>
            {warnings.length ? (
              <ul className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4">
                {warnings.map((w) => (
                  <li key={w} className="flex gap-2 text-sm text-ink-2">
                    <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
                    {w}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <ContactsPanel jobId={job.id} contacts={contacts} />
          <FilesPanel jobId={job.id} attached={documents.map((d) => d.document)} library={library.map((r) => r.document)} userId={user.id} mode={usesBlob() ? "blob" : "local"} />

          {job.description ? (
            <section aria-labelledby="posting-heading">
              <details className="group rounded-lg border border-line bg-surface">
                <summary className="flex items-center justify-between px-4 py-3 font-semibold marker:content-none" id="posting-heading">
                  Job description
                  <span className="text-xs font-normal text-ink-3 group-open:hidden">Show</span>
                  <span className="hidden text-xs font-normal text-ink-3 group-open:inline">Hide</span>
                </summary>
                <div className="max-h-[60vh] overflow-y-auto border-t border-line px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-2">{job.description}</div>
              </details>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
