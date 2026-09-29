import { CalendarClock, CircleAlert, ListTodo } from "lucide-react";
import type { JobListItem } from "@/data/jobs";
import { dayKey, daysBetweenKeys, formatDateTime, formatDayInline } from "@/lib/dates";
import { cn } from "@/lib/cn";

/**
 * The one line of "what's next" under a job: the next event if there is one,
 * otherwise your follow-up. Never both — one next thing is easier to act on.
 */
export function NextThing({
  job,
  timeZone,
  now = new Date(),
  wrap = false,
}: {
  job: Pick<JobListItem, "nextEventAt" | "nextEventTitle" | "nextAction" | "nextActionDue" | "stage">;
  timeZone: string;
  now?: Date;
  /** Allow two lines instead of truncating to one. */
  wrap?: boolean;
}) {
  if (job.stage === "closed") return null;
  const text = wrap ? "line-clamp-2" : "truncate";
  if (job.nextEventAt) {
    return (
      <span className="inline-flex min-w-0 items-start gap-1.5 text-xs text-ink-2" suppressHydrationWarning>
        <CalendarClock aria-hidden className="mt-px size-3.5 shrink-0 text-ink-3" />
        <span className={text}>
          {job.nextEventTitle ?? "Event"}, {formatDateTime(job.nextEventAt, timeZone, now)}
        </span>
      </span>
    );
  }
  if (job.nextAction || job.nextActionDue) {
    const diff = job.nextActionDue ? daysBetweenKeys(dayKey(now, timeZone), job.nextActionDue) : null;
    const overdue = diff != null && diff < 0;
    return (
      <span className={cn("inline-flex min-w-0 items-start gap-1.5 text-xs", overdue ? "font-medium text-danger" : "text-ink-2")}>
        {overdue ? <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" /> : <ListTodo aria-hidden className="mt-px size-3.5 shrink-0 text-ink-3" />}
        <span className={text}>
          {job.nextAction ?? "Follow up"}
          {job.nextActionDue ? `, ${overdue ? "was due " : "due "}${formatDayInline(job.nextActionDue, dayKey(now, timeZone))}` : ""}
        </span>
      </span>
    );
  }
  return null;
}

/** Five pips for interest, in ink — yellow is reserved for things that need you. */
export function InterestPips({ value, className }: { value: number | null; className?: string }) {
  if (!value) return null;
  return (
    <span role="img" aria-label={`Interest ${value} of 5`} className={cn("inline-flex gap-[2px]", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden className={cn("h-2 w-1 rounded-[1px]", n <= value ? "bg-ink-2" : "bg-line-strong")} />
      ))}
    </span>
  );
}
