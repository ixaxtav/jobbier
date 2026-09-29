"use client";

import { useFormAction } from "@/lib/client/use-form-action";
import { CalendarPlus, MapPin, MoreHorizontal, Plus, Video } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteEventAction, saveEventAction } from "@/actions/details";
import type { JobEvent } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { dayKey, formatDateTime, formatTime, utcToZonedLocal } from "@/lib/dates";
import { EVENT_KIND_LABEL, EVENT_KINDS } from "@/lib/events";
import { cn } from "@/lib/cn";
import { displayHost } from "@/lib/format";

/** Interviews, calls, take-homes and deadlines for one job. */
export function EventsPanel({ jobId, company, events, timeZone }: { jobId: string; company: string; events: JobEvent[]; timeZone: string }) {
  const [editing, setEditing] = useState<JobEvent | "new" | null>(null);
  const now = new Date();
  const upcoming = events.filter((e) => e.startsAt >= new Date(now.getTime() - 60 * 60_000));
  const past = events.filter((e) => e.startsAt < new Date(now.getTime() - 60 * 60_000)).reverse();

  return (
    <section aria-labelledby="schedule-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="schedule-heading" className="text-lg font-semibold">
          Schedule
        </h2>
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setEditing("new")}>
          Add
        </Button>
      </div>

      {events.length === 0 ? (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-4 text-left text-sm text-ink-2 hover:border-ink-3 hover:text-ink"
        >
          <CalendarPlus aria-hidden className="size-5 shrink-0 text-ink-3" />
          Add an interview, call, or deadline to see it on Today and in your calendar.
        </button>
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((e) => (
            <EventRow key={e.id} event={e} timeZone={timeZone} onEdit={() => setEditing(e)} />
          ))}
          {past.length ? (
            <li>
              <details className="group">
                <summary className="py-1 text-xs font-medium text-ink-3 hover:text-ink">
                  {past.length} past {past.length === 1 ? "event" : "events"}
                </summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {past.map((e) => (
                    <EventRow key={e.id} event={e} timeZone={timeZone} onEdit={() => setEditing(e)} past />
                  ))}
                </ul>
              </details>
            </li>
          ) : null}
        </ul>
      )}

      {editing ? (
        <EventDialog
          key={editing === "new" ? "new" : editing.id}
          jobId={jobId}
          company={company}
          event={editing === "new" ? null : editing}
          timeZone={timeZone}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

function EventRow({ event, timeZone, onEdit, past }: { event: JobEvent; timeZone: string; onEdit: () => void; past?: boolean }) {
  const [pending, start] = useTransition();
  const host = displayHost(event.location);
  const isLink = Boolean(host && /^https?:\/\//.test(event.location ?? ""));
  const soon = !past && dayKey(event.startsAt, timeZone) === dayKey(new Date(), timeZone);
  return (
    <li className={cn("flex gap-3 rounded-lg border bg-surface px-3.5 py-3", soon ? "border-highlight" : "border-line", past && "opacity-70")}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{event.title}</p>
        <p className="text-sm text-ink-2" suppressHydrationWarning>
          {EVENT_KIND_LABEL[event.kind]}, {formatDateTime(event.startsAt, timeZone)}
          {event.kind !== "deadline" ? ` to ${formatTime(new Date(event.startsAt.getTime() + event.durationMinutes * 60_000), timeZone)}` : ""}
        </p>
        {event.location ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
            {isLink ? <Video aria-hidden className="size-3.5 shrink-0" /> : <MapPin aria-hidden className="size-3.5 shrink-0" />}
            {isLink ? (
              <a href={event.location} target="_blank" rel="noopener noreferrer" className="truncate underline underline-offset-2 hover:text-ink">
                Join on {host}
              </a>
            ) : (
              <span className="truncate">{event.location}</span>
            )}
          </p>
        ) : null}
        {event.notes ? <p className="mt-1.5 line-clamp-3 text-sm whitespace-pre-wrap text-ink-2">{event.notes}</p> : null}
      </div>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" aria-label={`Options for ${event.title}`} disabled={pending} className="-mt-1 -mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink">
            <MoreHorizontal className="size-4" />
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onEdit}>Edit</MenuItem>
          <MenuItem asChild>
            <a href={`/api/events/${event.id}/ics`}>Add to calendar</a>
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            destructive
            onSelect={() =>
              start(async () => {
                const result = await deleteEventAction(event.id);
                if (result.ok) toast("Event removed");
                else toast.error(result.error);
              })
            }
          >
            Delete
          </MenuItem>
        </MenuContent>
      </Menu>
    </li>
  );
}

function EventDialog({
  jobId,
  company,
  event,
  timeZone,
  onClose,
}: {
  jobId: string;
  company: string;
  event: JobEvent | null;
  timeZone: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useFormAction(saveEventAction.bind(null, event?.id ?? null));
  const [kind, setKind] = useState(event?.kind ?? "interview");
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  useEffect(() => {
    if (state?.ok) {
      toast(event ? "Event updated" : "Event added");
      onClose();
    }
  }, [state, event, onClose]);

  const defaultStart = event ? utcToZonedLocal(event.startsAt, timeZone) : defaultStartLocal(timeZone);

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={event ? "Edit event" : "Add to the schedule"}
      description={`For ${company}. Times are in ${timeZone.replace(/_/g, " ")}.`}
    >
      <form onSubmit={action} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="jobId" value={jobId} />
        <Field label="What is it?" className="sm:col-span-1">
          {(p) => (
            <Select {...p} name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              {EVENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {EVENT_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Title" error={errors.title}>
          {(p) => <Input {...p} name="title" defaultValue={event?.title ?? ""} placeholder={kind === "deadline" ? "Take-home due" : "Call with the recruiter"} required />}
        </Field>
        <Field label={kind === "deadline" ? "Due" : "Starts"} error={errors.startsAt}>
          {(p) => <Input {...p} name="startsAt" type="datetime-local" defaultValue={defaultStart} required />}
        </Field>
        {kind !== "deadline" ? (
          <Field label="Length" error={errors.durationMinutes}>
            {(p) => (
              <Select {...p} name="durationMinutes" defaultValue={String(event?.durationMinutes ?? 45)}>
                {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <input type="hidden" name="durationMinutes" value="15" />
        )}
        <Field label="Where" hint="An address or a video link" error={errors.location} className="sm:col-span-2">
          {(p) => <Input {...p} name="location" defaultValue={event?.location ?? ""} placeholder="https://meet.google.com/…" />}
        </Field>
        <Field label="Notes" error={errors.notes} className="sm:col-span-2">
          {(p) => <Textarea {...p} name="notes" defaultValue={event?.notes ?? ""} rows={3} placeholder="Who you’re meeting, what to prepare" />}
        </Field>
        <div className="sm:col-span-2">
          <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="ink" pending={pending}>
            {event ? "Save changes" : "Add event"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Tomorrow at 10:00 in the user's zone — a sensible default for scheduling. */
function defaultStartLocal(timeZone: string) {
  const tomorrow = new Date(Date.now() + 86_400_000);
  return `${dayKey(tomorrow, timeZone)}T10:00`;
}
