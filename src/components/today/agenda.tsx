import { CalendarPlus, MapPin, Video } from "lucide-react";
import Link from "next/link";
import type { JobEvent } from "@/db/schema";
import { dayKey, formatDayLabel, formatTime } from "@/lib/dates";
import { EVENT_KIND_LABEL } from "@/lib/events";
import { displayHost } from "@/lib/format";

type Row = { event: JobEvent; company: string; jobTitle: string };

export function Agenda({ rows, timeZone, now }: { rows: Row[]; timeZone: string; now: Date }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong px-4 py-5 text-sm text-ink-2">
        No interviews or deadlines in the next two weeks. Add them from a job’s page and they’ll line up here.
      </p>
    );
  }

  const today = dayKey(now, timeZone);
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = dayKey(row.event.startsAt, timeZone);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return (
    <div className="flex flex-col gap-5">
      {[...groups.entries()].map(([key, dayRows]) => (
        <section key={key} aria-label={formatDayLabel(key, today)}>
          <h3 className="mb-2 text-sm font-semibold">
            {formatDayLabel(key, today)}
            {key !== today ? (
              <span className="ml-2 font-normal text-ink-3">
                {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`))}
              </span>
            ) : null}
          </h3>
          <ul className="flex flex-col gap-2">
            {dayRows.map(({ event, company, jobTitle }) => {
              const host = displayHost(event.location);
              const isLink = Boolean(event.location && /^https?:\/\//.test(event.location) && host);
              return (
                <li key={event.id} className="group relative grid grid-cols-[4.5rem_1fr_auto] items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3">
                  <span className="pt-0.5 text-sm font-semibold tabular">{formatTime(event.startsAt, timeZone)}</span>
                  <div className="min-w-0">
                    <Link href={`/jobs/${event.jobId}`} className="block truncate font-medium after:absolute after:inset-0">
                      {event.title}
                    </Link>
                    <p className="line-clamp-2 text-sm text-ink-2 sm:truncate">
                      {EVENT_KIND_LABEL[event.kind]} for {jobTitle} at {company}
                    </p>
                    {event.location ? (
                      <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-ink-3">
                        {isLink ? <Video aria-hidden className="size-3.5 shrink-0" /> : <MapPin aria-hidden className="size-3.5 shrink-0" />}
                        <span className="truncate">{isLink ? host : event.location}</span>
                      </p>
                    ) : null}
                  </div>
                  <a
                    href={`/api/events/${event.id}/ics`}
                    className="relative z-10 -mr-1.5 flex size-8 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink"
                    aria-label={`Add "${event.title}" to your calendar`}
                    title="Add to calendar"
                  >
                    <CalendarPlus className="size-4" />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
