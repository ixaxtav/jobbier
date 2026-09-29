"use client";

import { useFormAction } from "@/lib/client/use-form-action";
import { Check, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { clearNextActionAction, setNextActionAction } from "@/actions/jobs";
import { Button, IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { addDaysToKey, dayKey, daysBetweenKeys, formatDayInline } from "@/lib/dates";
import { cn } from "@/lib/cn";

const SUGGESTIONS: Record<string, string> = {
  saved: "Apply",
  applied: "Follow up with the recruiter",
  interviewing: "Send a thank-you note",
  offer: "Reply to the offer",
};

/**
 * One next step per job, with an optional due date. It's what Today's
 * "Needs you" list is built from, so it's deliberately simple.
 */
export function NextStep({
  jobId,
  stage,
  nextAction,
  nextActionDue,
  timeZone,
}: {
  jobId: string;
  stage: string;
  nextAction: string | null;
  nextActionDue: string | null;
  timeZone: string;
}) {
  const hasStep = Boolean(nextAction || nextActionDue);
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useFormAction(async (prev: Awaited<ReturnType<typeof setNextActionAction>> | null, form: FormData) => {
    const result = await setNextActionAction(prev, form);
    if (result.ok) setEditing(false);
    return result;
  });
  const [clearing, startClear] = useTransition();
  const today = dayKey(new Date(), timeZone);

  if (stage === "closed") return null;

  if (hasStep && !editing) {
    const diff = nextActionDue ? daysBetweenKeys(today, nextActionDue) : null;
    return (
      <section aria-labelledby="next-step" className={cn("flex items-center gap-3 rounded-lg border px-4 py-3.5", diff != null && diff <= 0 ? "border-highlight bg-highlight-soft/70 dark:bg-highlight-soft/40" : "border-line bg-surface")}>
        <div className="min-w-0 flex-1">
          <h2 id="next-step" className="text-xs font-medium text-ink-3">
            Next step
          </h2>
          <p className="font-medium">{nextAction ?? "Follow up"}</p>
          {nextActionDue ? (
            <p className={cn("text-sm", diff! < 0 ? "font-medium text-danger" : "text-ink-2")}>
              {diff! < 0 ? `Was due ${formatDayInline(nextActionDue, today)}` : `Due ${formatDayInline(nextActionDue, today)}`}
            </p>
          ) : null}
        </div>
        <IconButton label="Edit next step" onClick={() => setEditing(true)}>
          <Pencil />
        </IconButton>
        <Button
          size="sm"
          icon={<Check />}
          pending={clearing}
          onClick={() =>
            startClear(async () => {
              const result = await clearNextActionAction(jobId);
              if (result.ok) toast("Marked done");
              else toast.error(result.error);
            })
          }
        >
          Done
        </Button>
      </section>
    );
  }

  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const quickDates = [
    { label: "Tomorrow", value: addDaysToKey(today, 1) },
    { label: "In 3 days", value: addDaysToKey(today, 3) },
    { label: "Next week", value: addDaysToKey(today, 7) },
  ];

  return (
    <section aria-labelledby="next-step-form" className="rounded-lg border border-line bg-surface px-4 py-4">
      <h2 id="next-step-form" className="mb-2 text-sm font-semibold">
        What’s the next step?
      </h2>
      <NextStepForm
        action={action}
        pending={pending}
        jobId={jobId}
        errors={errors}
        defaults={{ nextAction: nextAction ?? "", nextActionDue: nextActionDue ?? "" }}
        placeholder={SUGGESTIONS[stage] ?? "Follow up"}
        quickDates={quickDates}
        onCancel={hasStep ? () => setEditing(false) : undefined}
      />
    </section>
  );
}

function NextStepForm({
  action,
  pending,
  jobId,
  errors,
  defaults,
  placeholder,
  quickDates,
  onCancel,
}: {
  action: React.FormEventHandler<HTMLFormElement>;
  pending: boolean;
  jobId: string;
  errors: Record<string, string>;
  defaults: { nextAction: string; nextActionDue: string };
  placeholder: string;
  quickDates: { label: string; value: string }[];
  onCancel?: () => void;
}) {
  const [due, setDue] = useState(defaults.nextActionDue);
  return (
    <form onSubmit={action} className="flex flex-col gap-3">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`na-${jobId}`}>
          Next step
        </label>
        <Input id={`na-${jobId}`} name="nextAction" defaultValue={defaults.nextAction} placeholder={placeholder} aria-invalid={errors.nextAction ? true : undefined} className="sm:flex-1" />
        <label className="sr-only" htmlFor={`nd-${jobId}`}>
          Due date
        </label>
        <Input id={`nd-${jobId}`} name="nextActionDue" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="sm:w-44" />
      </div>
      {errors.nextAction ? <p className="text-xs font-medium text-danger">{errors.nextAction}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {quickDates.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setDue(d.value)}
            aria-pressed={due === d.value}
            className={cn("h-7 rounded-full border px-2.5 text-xs font-medium", due === d.value ? "border-ink bg-ink text-bg" : "border-line-strong text-ink-2 hover:text-ink")}
          >
            {d.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {onCancel ? (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button size="sm" variant="ink" type="submit" pending={pending}>
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}
