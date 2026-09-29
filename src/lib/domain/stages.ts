import type { Outcome, Stage } from "@/db/schema";

/** The stops on the line, in order. `closed` sits off the line and carries an outcome. */
export const TRACK = ["saved", "applied", "interviewing", "offer"] as const satisfies readonly Stage[];
export const STAGES = [...TRACK, "closed"] as const satisfies readonly Stage[];
export const OUTCOMES = ["hired", "rejected", "declined", "withdrew", "ghosted"] as const satisfies readonly Outcome[];

type StageMeta = {
  label: string;
  /** Short description for empty states and tooltips. */
  hint: string;
  /** The button copy that moves a job into this stage. */
  action: string;
};

export const STAGE_META: Record<Stage, StageMeta> = {
  saved: { label: "Saved", hint: "Jobs you might apply to", action: "Move to saved" },
  applied: { label: "Applied", hint: "Waiting to hear back", action: "Mark as applied" },
  interviewing: { label: "Interviewing", hint: "Talking with the company", action: "Mark as interviewing" },
  offer: { label: "Offer", hint: "An offer is on the table", action: "Mark as offer" },
  closed: { label: "Closed", hint: "Hired, rejected, or moved on", action: "Close" },
};

type OutcomeMeta = { label: string; tone: "good" | "bad" | "neutral"; describe: string };

export const OUTCOME_META: Record<Outcome, OutcomeMeta> = {
  hired: { label: "Hired", tone: "good", describe: "You accepted the offer" },
  rejected: { label: "Rejected", tone: "bad", describe: "They passed" },
  declined: { label: "Declined", tone: "neutral", describe: "You turned down the offer" },
  withdrew: { label: "Withdrew", tone: "neutral", describe: "You pulled out" },
  ghosted: { label: "No reply", tone: "neutral", describe: "They never got back to you" },
};

export function trackIndex(stage: Stage): number {
  return (TRACK as readonly Stage[]).indexOf(stage);
}

export function isActive(stage: Stage) {
  return stage !== "closed";
}

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

export function isOutcome(value: unknown): value is Outcome {
  return typeof value === "string" && (OUTCOMES as readonly string[]).includes(value);
}

type StageState = {
  stage: Stage;
  furthestStage: Stage;
  outcome: Outcome | null;
  appliedAt: Date | null;
};

/**
 * Works out every field that changes when a job moves stage. Pure, so the rules
 * live in one tested place instead of being scattered across actions.
 */
export function applyStageChange(
  current: StageState,
  to: Stage,
  outcome: Outcome | null,
  now: Date,
): (StageState & { stageChangedAt: Date }) | { error: string } {
  if (to === "closed" && !outcome) return { error: "Choose how it ended before closing it." };
  if (to !== "closed" && outcome) return { error: "Only closed jobs have an outcome." };
  if (to === current.stage && outcome === current.outcome) return { error: "It's already there." };

  const reached = to === "closed" ? impliedStageForOutcome(outcome!) : to;
  const furthestStage = trackIndex(reached) > trackIndex(current.furthestStage) ? reached : current.furthestStage;

  return {
    stage: to,
    outcome: to === "closed" ? outcome : null,
    furthestStage,
    // First time the job gets past "saved", that's when you applied.
    appliedAt: current.appliedAt ?? (trackIndex(furthestStage) >= trackIndex("applied") ? now : null),
    stageChangedAt: now,
  };
}

/**
 * The stop an outcome implies you reached, even if the job skipped it:
 * hired/declined means there was an offer; rejected/ghosted means you applied.
 * Withdrawing says nothing — you may have pulled out before applying.
 */
function impliedStageForOutcome(outcome: Outcome): Stage {
  if (outcome === "hired" || outcome === "declined") return "offer";
  if (outcome === "rejected" || outcome === "ghosted") return "applied";
  return "saved";
}
