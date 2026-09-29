"use client";

import type { Outcome } from "@/db/schema";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { OUTCOME_META, OUTCOMES } from "@/lib/domain/stages";

/** "How did it end?" — closing a job always records why, so stats stay honest. */
export function CloseJobDialog({
  open,
  onOpenChange,
  jobLabel,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobLabel: string;
  onPick: (outcome: Outcome) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="How did it end?" description={jobLabel} size="sm">
      <div className="grid gap-2" role="list">
        {OUTCOMES.map((outcome, i) => {
          const meta = OUTCOME_META[outcome];
          return (
            <button
              key={outcome}
              type="button"
              role="listitem"
              data-autofocus={i === 0 ? true : undefined}
              onClick={() => onPick(outcome)}
              className="flex items-center gap-3 rounded-md border border-line px-4 py-3 text-left hover:border-ink-3 hover:bg-surface-2"
            >
              <span
                aria-hidden
                className={cn("size-2.5 shrink-0 rounded-full", meta.tone === "good" ? "bg-good" : meta.tone === "bad" ? "bg-danger" : "bg-stage-closed")}
              />
              <span className="flex-1">
                <span className="block font-medium">{meta.label}</span>
                <span className="block text-sm text-ink-2">{meta.describe}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
