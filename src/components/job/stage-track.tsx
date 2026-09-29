"use client";

import { Check, RotateCcw } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { moveJobAction } from "@/actions/jobs";
import type { Outcome, Stage } from "@/db/schema";
import { CloseJobDialog } from "@/components/jobs/close-job-dialog";
import { STAGE_BG, STAGE_TEXT, stageLabel } from "@/components/stage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { OUTCOME_META, STAGE_META, TRACK, trackIndex } from "@/lib/domain/stages";

type State = { stage: Stage; outcome: Outcome | null; furthestStage: Stage };

/**
 * The line, full size and interactive. Tap a stop to move the job there.
 * Everything up to the furthest stop reached stays drawn, so moving back
 * doesn't erase history.
 */
export function StageTrack({ jobId, jobLabel, initial }: { jobId: string; jobLabel: string; initial: State }) {
  const [state, setOptimistic] = useOptimistic(initial, (s, next: State) => next);
  const [, start] = useTransition();
  const [closing, setClosing] = useState(false);

  function move(stage: Stage, outcome: Outcome | null = null) {
    if (stage === state.stage && outcome === state.outcome) return;
    const previous = { stage: state.stage, outcome: state.outcome };
    const furthest = trackIndex(stage) > trackIndex(state.furthestStage) ? stage : state.furthestStage;
    start(async () => {
      setOptimistic({ stage, outcome, furthestStage: furthest });
      const result = await moveJobAction(jobId, stage, outcome);
      if (!result.ok) return void toast.error(result.error);
      // A stop is one tap away, so every move can be taken back.
      toast(`Moved to ${stageLabel(stage, outcome)}`, {
        action: {
          label: "Undo",
          onClick: () =>
            void moveJobAction(jobId, previous.stage, previous.outcome).then((r) => {
              if (!r.ok) toast.error(r.error);
            }),
        },
      });
    });
  }

  const closed = state.stage === "closed";
  const current = closed ? -1 : trackIndex(state.stage);
  const reached = trackIndex(state.furthestStage);

  return (
    <section aria-label="Stage" className="rounded-lg border border-line bg-surface px-4 pt-5 pb-4 sm:px-6">
      <ol className="grid grid-cols-4">
        {TRACK.map((stage, i) => {
          const isCurrent = i === current;
          const isReached = i <= Math.max(reached, current);
          const segmentLit = i < Math.max(reached, current); // segment to the right of this stop
          const color = closed ? "bg-stage-closed" : STAGE_BG[state.stage];
          return (
            <li key={stage} className="relative">
              <button
                type="button"
                onClick={() => move(stage)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={isCurrent ? `${STAGE_META[stage].label} (current)` : STAGE_META[stage].action}
                className="group flex w-full flex-col items-center gap-2.5 rounded-md pb-1 outline-offset-2"
              >
                <span aria-hidden className="relative flex h-7 w-full items-center justify-center">
                  {i > 0 ? <span className={cn("absolute top-1/2 left-0 h-1 w-1/2 -translate-y-1/2", i <= Math.max(reached, current) ? color : "bg-line-strong")} /> : null}
                  {i < TRACK.length - 1 ? <span className={cn("absolute top-1/2 right-0 h-1 w-1/2 -translate-y-1/2", segmentLit ? color : "bg-line-strong")} /> : null}
                  <span
                    className={cn(
                      "relative flex items-center justify-center rounded-full ring-4 ring-surface transition-all duration-150",
                      isCurrent ? cn("size-7", color) : cn("size-3.5 group-hover:size-5", isReached ? color : "bg-line-strong group-hover:bg-ink-3"),
                    )}
                  >
                    {isCurrent ? <Check className="size-4 text-white" strokeWidth={3} /> : null}
                  </span>
                </span>
                <span className={cn("text-xs font-medium sm:text-sm", isCurrent ? cn("font-semibold", STAGE_TEXT[stage]) : "text-ink-2 group-hover:text-ink")}>
                  {STAGE_META[stage].label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        {closed && state.outcome ? (
          <>
            <p className="text-sm">
              <span className="font-semibold">Closed: {OUTCOME_META[state.outcome].label}.</span>{" "}
              <span className="text-ink-2">{OUTCOME_META[state.outcome].describe}.</span>
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setClosing(true)}>
                Change outcome
              </Button>
              <Button size="sm" icon={<RotateCcw />} onClick={() => move(state.furthestStage)}>
                Reopen
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-2">{STAGE_META[state.stage].hint}. Tap a stop to move it.</p>
            <Button size="sm" variant="ghost" onClick={() => setClosing(true)}>
              Close this job…
            </Button>
          </>
        )}
      </div>

      <CloseJobDialog
        open={closing}
        onOpenChange={setClosing}
        jobLabel={jobLabel}
        onPick={(outcome) => {
          setClosing(false);
          move("closed", outcome);
        }}
      />
    </section>
  );
}
