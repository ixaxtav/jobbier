import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Monogram } from "@/components/monogram";
import { MiniLine, StageTag } from "@/components/stage";
import { dayKey, formatDayLabel } from "@/lib/dates";
import { formatPay, formatWhere } from "@/lib/format";
import type { BoardJob } from "./job-board";
import { InterestPips, NextThing } from "./job-meta";

/** Dense, scannable rows. On phones each row stacks; on desktop it aligns into columns. */
export function JobList({ jobs, timeZone }: { jobs: BoardJob[]; timeZone: string }) {
  const now = new Date();
  const today = dayKey(now, timeZone);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div
        aria-hidden
        className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.6fr)_5.5rem] gap-4 border-b border-line bg-surface-2/50 px-4 py-2 text-xs font-medium text-ink-3 lg:grid"
      >
        <span>Role</span>
        <span>Stage</span>
        <span>Pay</span>
        <span>Next</span>
        <span className="text-right">Applied</span>
      </div>
      <ul className="divide-y divide-line">
        {jobs.map((job) => {
          const pay = formatPay(job.payMin, job.payMax, job.payPeriod, job.currency);
          const where = formatWhere(job.location, job.workMode);
          return (
            <li
              key={job.id}
              className="relative grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-4 py-3.5 hover:bg-surface-2/40 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.6fr)_5.5rem] lg:items-center lg:gap-4 lg:py-3"
            >
              <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
                <Monogram name={job.company} />
                <div className="min-w-0">
                  <Link href={`/jobs/${job.id}`} className="block truncate font-medium after:absolute after:inset-0">
                    {job.title}
                  </Link>
                  <p className="truncate text-sm text-ink-2">
                    {job.company}
                    {where ? <span className="text-ink-3">, {where}</span> : null}
                  </p>
                </div>
              </div>
              <div className="col-start-2 flex items-center gap-2.5 lg:col-start-auto">
                <MiniLine stage={job.stage} furthestStage={job.furthestStage} outcome={job.outcome} className="max-sm:hidden" />
                <StageTag stage={job.stage} outcome={job.outcome} />
                <InterestPips value={job.excitement} className="lg:hidden" />
              </div>
              <div className="col-start-2 flex items-center gap-1.5 text-sm text-ink-2 tabular empty:hidden lg:col-start-auto">
                {pay ?? <span className="text-ink-3 max-lg:hidden">—</span>}
                {job.warnings.length ? (
                  <span title={job.warnings.join("\n")} className="relative z-10 text-ink-3">
                    <TriangleAlert className="size-3.5" aria-label={job.warnings.join(". ")} />
                  </span>
                ) : null}
              </div>
              <div className="col-start-2 min-w-0 empty:hidden lg:col-start-auto">
                <NextThing job={job} timeZone={timeZone} now={now} />
              </div>
              <div className="hidden text-right text-sm text-ink-3 tabular lg:block">
                {job.appliedAt ? formatDayLabel(dayKey(job.appliedAt, timeZone), today) : "—"}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
