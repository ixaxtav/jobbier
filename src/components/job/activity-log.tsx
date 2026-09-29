"use client";

import { useFormAction } from "@/lib/client/use-form-action";
import { CalendarPlus, Gift, MoveRight, Plus, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { addNoteAction, deleteNoteAction } from "@/actions/details";
import type { Activity, Outcome, Stage } from "@/db/schema";
import { stageLabel } from "@/components/stage";
import { Button, IconButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { EVENT_KIND_LABEL } from "@/lib/events";
import type { EventKind } from "@/db/schema";

/**
 * One timeline per job: what you did (notes) and what happened (stage moves,
 * scheduled events). Replaces JobCore's separate "comments", "clock-in log",
 * and "ratings" panels with a single history.
 */
export function ActivityLog({ jobId, activities, timeZone }: { jobId: string; activities: Activity[]; timeZone: string }) {
  const [state, action, pending] = useFormAction(addNoteAction);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) form.current?.reset();
    else if (state && !state.ok) toast.error(state.error);
  }, [state]);

  return (
    <section aria-labelledby="log-heading">
      <h2 id="log-heading" className="mb-3 text-lg font-semibold">
        Log
      </h2>
      <form ref={form} onSubmit={action} className="mb-5 flex flex-col gap-2">
        <input type="hidden" name="jobId" value={jobId} />
        <label htmlFor={`note-${jobId}`} className="sr-only">
          Add a note
        </label>
        <Textarea
          id={`note-${jobId}`}
          name="body"
          rows={2}
          placeholder="Add a note — what they asked, who you spoke to, how it felt…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              form.current?.requestSubmit();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-3 max-sm:hidden">⌘ Enter to save</span>
          <Button type="submit" size="sm" variant="ink" icon={<Plus />} pending={pending} className="ml-auto">
            Add note
          </Button>
        </div>
      </form>

      {activities.length === 0 ? (
        <p className="text-sm text-ink-3">Nothing logged yet.</p>
      ) : (
        <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-line">
          {activities.map((a) => (
            <Entry key={a.id} activity={a} timeZone={timeZone} />
          ))}
        </ol>
      )}
    </section>
  );
}

function Entry({ activity, timeZone }: { activity: Activity; timeZone: string }) {
  const [pending, start] = useTransition();
  const meta = activity.meta ?? {};
  const when = (
    <time dateTime={activity.createdAt.toISOString()} title={formatDateTime(activity.createdAt, timeZone)} className="text-xs text-ink-3" suppressHydrationWarning>
      {formatRelative(activity.createdAt)}
    </time>
  );

  let icon = <MoveRight />;
  let text: React.ReactNode;
  switch (activity.kind) {
    case "created":
      icon = <Plus />;
      text = <>Added to {stageLabel((meta.stage as Stage) ?? "saved", null)}</>;
      break;
    case "lead":
      icon = <Gift />;
      text = <>Saved from {meta.from ?? "a friend"}&rsquo;s lead</>;
      break;
    case "stage":
      text = (
        <>
          Moved to <span className="font-medium">{stageLabel(meta.to as Stage, (meta.outcome as Outcome) ?? null)}</span>
        </>
      );
      break;
    case "event":
      icon = <CalendarPlus />;
      text = (
        <>
          Scheduled {EVENT_KIND_LABEL[(meta.kind as EventKind) ?? "other"].toLowerCase()}: <span className="font-medium">{meta.title}</span>
        </>
      );
      break;
    case "note":
      icon = <StickyNote />;
      break;
  }

  return (
    <li className="group relative flex gap-3">
      <span aria-hidden className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-3 [&_svg]:size-3.5">
        {icon}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        {activity.kind === "note" ? (
          <div className="rounded-md border border-line bg-surface px-3.5 py-2.5">
            <p className="text-sm whitespace-pre-wrap">{activity.body}</p>
            <div className="mt-1.5 flex items-center justify-between">
              {when}
              <IconButton
                size="sm"
                label="Delete note"
                disabled={pending}
                className="-my-1 -mr-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                onClick={() =>
                  start(async () => {
                    const result = await deleteNoteAction(activity.id);
                    if (!result.ok) toast.error(result.error);
                  })
                }
              >
                <Trash2 />
              </IconButton>
            </div>
          </div>
        ) : (
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink-2">
            <span>{text}</span>
            {when}
          </p>
        )}
      </div>
    </li>
  );
}
