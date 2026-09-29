import type { SearchStats } from "@/lib/domain/stats";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";

function percent(rate: number | null) {
  return rate == null ? "—" : `${Math.round(rate * 100)}%`;
}

export function WeekStats({ stats }: { stats: SearchStats }) {
  if (stats.totalApplied === 0) {
    return (
      <section aria-labelledby="week-heading">
        <h2 id="week-heading" className="text-sm font-semibold text-ink-2">
          This week
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          Once you mark jobs as applied, your weekly pace and how often companies reply show up here.
        </p>
      </section>
    );
  }
  const diff = stats.appliedThisWeek - stats.appliedLastWeek;
  const comparison =
    stats.appliedLastWeek === 0 && stats.appliedThisWeek === 0
      ? "None last week either"
      : diff === 0
        ? "Same as last week"
        : diff > 0
          ? `${diff} more than last week`
          : `${-diff} fewer than last week`;

  return (
    <section aria-labelledby="week-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="week-heading" className="text-sm font-semibold text-ink-2">
          This week
        </h2>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl leading-none font-bold tabular">{stats.appliedThisWeek}</span>
          <span className="text-ink-2">{stats.appliedThisWeek === 1 ? "application" : "applications"}</span>
        </p>
        <p className="mt-1 text-sm text-ink-3">{comparison}</p>
      </div>

      <WeekBars weeks={stats.weeks} />

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line">
        <div className="bg-surface p-3">
          <dt className="text-xs text-ink-3">Heard back</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular">{percent(stats.responseRate)}</dd>
        </div>
        <div className="bg-surface p-3">
          <dt className="text-xs text-ink-3">Got interviews</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular">{percent(stats.interviewRate)}</dd>
        </div>
      </dl>
      <p className="-mt-3 text-xs text-ink-3">Out of {pluralize(stats.totalApplied, "application")} so far.</p>
    </section>
  );
}

/** Applications per week for the last 8 weeks. One series: no legend, a tooltip per bar, a text equivalent. */
function WeekBars({ weeks }: { weeks: SearchStats["weeks"] }) {
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const label = (start: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${start}T12:00:00Z`));

  return (
    <figure>
      <div className="flex h-16 items-end gap-[3px]" aria-hidden>
        {weeks.map((w, i) => {
          const current = i === weeks.length - 1;
          return (
            <div key={w.start} className="group relative flex h-full flex-1 items-end">
              <div
                className={cn(
                  "w-full rounded-t-[4px] transition-colors",
                  w.count === 0 ? "h-[2px] rounded-[1px] bg-line-strong" : current ? "bg-ink" : "bg-ink-3/55 group-hover:bg-ink-2",
                )}
                style={w.count ? { height: `${Math.max(8, (w.count / max) * 100)}%` } : undefined}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-sm bg-ink px-2 py-1 text-2xs whitespace-nowrap text-bg opacity-0 shadow-pop transition-opacity group-hover:opacity-100">
                {current ? "This week" : `Week of ${label(w.start)}`}: {w.count}
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-1.5 flex justify-between text-2xs text-ink-3">
        <span>{label(weeks[0].start)}</span>
        <span>Applications per week</span>
      </figcaption>
      <table className="sr-only">
        <caption>Applications per week</caption>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.start}>
              <th scope="row">Week of {label(w.start)}</th>
              <td>{w.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
