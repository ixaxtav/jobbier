"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { dismissGettingStartedAction } from "@/actions/settings";
import { useAddJob } from "@/components/jobs/add-job";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Steps = { hasJob: boolean; hasPreferences: boolean; hasFile: boolean };

/**
 * First-run guide. Three real steps in order (so numbering is honest), each
 * done in place. Replaces JobCore's six mandatory onboarding screens.
 */
export function GettingStarted({ steps, firstRun }: { steps: Steps; firstRun: boolean }) {
  const addJob = useAddJob();
  const [pending, start] = useTransition();
  const items = [
    {
      done: steps.hasJob,
      title: "Add the first job you're looking at",
      body: "Paste a link — Jobbier reads the posting and fills in the details.",
      action: (
        <Button variant="primary" size="sm" onClick={() => addJob.open()}>
          Add a job
        </Button>
      ),
    },
    {
      done: steps.hasFile,
      title: "Upload your résumé",
      body: "Keep every version in one place and note which one you sent where.",
      action: (
        <Link href="/files" className="text-sm font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          Go to Files
        </Link>
      ),
    },
    {
      done: steps.hasPreferences,
      title: "Set your pay floor",
      body: "Jobbier will flag jobs that pay less than you're willing to take.",
      action: (
        <Link href="/settings#preferences" className="text-sm font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          Open settings
        </Link>
      ),
    },
  ];

  return (
    <section aria-labelledby="getting-started" className="relative rounded-lg border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id="getting-started" className="text-lg font-semibold">
            {firstRun ? "Welcome to Jobbier" : "Getting started"}
          </h2>
          <p className="text-sm text-ink-2">Three things that make the rest of Jobbier useful.</p>
        </div>
        <button
          type="button"
          onClick={() => start(() => dismissGettingStartedAction())}
          disabled={pending}
          aria-label="Hide getting started"
          className="-mt-1 -mr-2 flex size-8 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
      <ol className="flex flex-col">
        {items.map((item, i) => (
          <li key={item.title} className="flex gap-4 border-t border-line py-4 first:border-t-0 first:pt-1 last:pb-0">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                item.done ? "bg-ink text-bg" : "border border-line-strong text-ink-2",
              )}
            >
              {item.done ? <Check className="size-4" aria-label="Done" /> : i + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={cn("font-medium", item.done && "text-ink-3 line-through decoration-line-strong")}>{item.title}</p>
                {!item.done ? <p className="text-sm text-ink-2">{item.body}</p> : null}
              </div>
              {!item.done ? <div className="shrink-0">{item.action}</div> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
