import type { Outcome, Stage } from "@/db/schema";
import { cn } from "@/lib/cn";
import { OUTCOME_META, STAGE_META, TRACK, trackIndex } from "@/lib/domain/stages";

/** Static class maps so Tailwind can see every class. */
export const STAGE_BG: Record<Stage, string> = {
  saved: "bg-stage-saved",
  applied: "bg-stage-applied",
  interviewing: "bg-stage-interviewing",
  offer: "bg-stage-offer",
  closed: "bg-stage-closed",
};
export const STAGE_TEXT: Record<Stage, string> = {
  saved: "text-stage-saved",
  applied: "text-stage-applied",
  interviewing: "text-stage-interviewing",
  offer: "text-stage-offer",
  closed: "text-stage-closed",
};
const STAGE_BORDER: Record<Stage, string> = {
  saved: "border-stage-saved",
  applied: "border-stage-applied",
  interviewing: "border-stage-interviewing",
  offer: "border-stage-offer",
  closed: "border-stage-closed",
};

export function stageLabel(stage: Stage, outcome: Outcome | null) {
  return stage === "closed" && outcome ? OUTCOME_META[outcome].label : STAGE_META[stage].label;
}

/** A small coloured label: "● Interviewing", or the outcome for closed jobs. */
export function StageTag({ stage, outcome, className }: { stage: Stage; outcome: Outcome | null; className?: string }) {
  const tone = stage === "closed" && outcome ? OUTCOME_META[outcome].tone : null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", className)}>
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          tone === "good" ? "bg-good" : tone === "bad" ? "bg-danger" : STAGE_BG[stage],
        )}
      />
      <span className={stage === "closed" ? "text-ink-3" : "text-ink-2"}>{stageLabel(stage, outcome)}</span>
    </span>
  );
}

/**
 * The mini line on every job row: four stops, filled up to where the job is.
 * Closed jobs show the furthest stop they reached, greyed out.
 */
export function MiniLine({
  stage,
  furthestStage,
  outcome,
  className,
}: {
  stage: Stage;
  furthestStage: Stage;
  outcome: Outcome | null;
  className?: string;
}) {
  const closed = stage === "closed";
  const at = closed ? trackIndex(furthestStage) : trackIndex(stage);
  const color = closed ? "bg-stage-closed" : STAGE_BG[stage];
  return (
    <span
      role="img"
      aria-label={`Stage: ${stageLabel(stage, outcome)}`}
      className={cn("relative inline-flex h-3 w-16 shrink-0 items-center justify-between", className)}
    >
      <span aria-hidden className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-line-strong" />
      <span
        aria-hidden
        className={cn("absolute left-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full", color)}
        style={{ width: `calc(${(Math.max(at, 0) / (TRACK.length - 1)) * 100}% - ${(Math.max(at, 0) / (TRACK.length - 1)) * 8}px)` }}
      />
      {TRACK.map((s, i) => (
        <span
          key={s}
          aria-hidden
          className={cn(
            "relative rounded-full",
            i === at && !closed ? "size-2.5 ring-2 ring-surface" : "size-1.5",
            i <= at ? color : "bg-line-strong",
          )}
        />
      ))}
    </span>
  );
}

export function StageDot({ stage, className }: { stage: Stage; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2.5 rounded-full", STAGE_BG[stage], className)} />;
}

export { STAGE_BORDER };
