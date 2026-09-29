"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setExcitementAction } from "@/actions/jobs";
import { INTEREST_LABELS } from "@/components/jobs/job-fields";
import { cn } from "@/lib/cn";

/** How much you want this one. Your own signal for what to prioritise. */
export function JobInterest({ jobId, value }: { jobId: string; value: number | null }) {
  const [current, set] = useOptimistic(value);
  const [, start] = useTransition();
  function pick(n: number) {
    const next = current === n ? null : n;
    start(async () => {
      set(next);
      const result = await setExcitementAction(jobId, next);
      if (!result.ok) toast.error(result.error);
    });
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink-3">Interest</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-2">{current ? INTEREST_LABELS[current] : "Not rated"}</span>
        <div role="radiogroup" aria-label="Interest" className="flex gap-[3px]">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={current === n}
              aria-label={INTEREST_LABELS[n]}
              title={INTEREST_LABELS[n]}
              onClick={() => pick(n)}
              className={cn("h-4 w-2 rounded-[2px] transition-colors", current && n <= current ? "bg-ink" : "bg-line-strong hover:bg-ink-3")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
