"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { MoreHorizontal, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { moveJobAction } from "@/actions/jobs";
import type { JobListItem } from "@/data/jobs";
import type { Outcome, Stage } from "@/db/schema";
import { STAGE_BG, stageLabel } from "@/components/stage";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { STAGE_META, STAGES } from "@/lib/domain/stages";
import { formatPay, formatWhere } from "@/lib/format";
import { CloseJobDialog } from "./close-job-dialog";
import { InterestPips, NextThing } from "./job-meta";

export type BoardJob = JobListItem & { warnings: string[] };
type Move = { jobId: string; stage: Stage; outcome: Outcome | null };

/**
 * Kanban board, one column per stage. Drag a card (mouse, touch, or keyboard:
 * focus the handle, Space, arrows, Space) or use its menu. Moves are optimistic.
 * On phones it shows one column at a time with a stage switcher.
 */
export function JobBoard({ jobs, timeZone, initialStage }: { jobs: BoardJob[]; timeZone: string; initialStage?: Stage }) {
  const [optimisticJobs, applyMove] = useOptimistic(jobs, (state, move: Move) =>
    state.map((j) => (j.id === move.jobId ? { ...j, stage: move.stage, outcome: move.outcome } : j)),
  );
  const [, start] = useTransition();
  const [dragging, setDragging] = useState<BoardJob | null>(null);
  const [closing, setClosing] = useState<BoardJob | null>(null);
  const [mobileStage, setMobileStage] = useState<Stage>(initialStage ?? "applied");
  const suppressClick = useRef(false);
  // A stable id keeps dnd-kit's generated aria attributes identical on server and client.
  const dndId = useId();

  // Dragging only makes sense when the columns sit side by side; on phones cards move via their menu,
  // and a drag sensor would fight with scrolling.
  const wide = useMediaQuery("(min-width: 768px)");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function move(job: BoardJob, stage: Stage, outcome: Outcome | null = null) {
    if (stage === job.stage && outcome === job.outcome) return;
    if (stage === "closed" && !outcome) return setClosing(job);
    const previous = { stage: job.stage, outcome: job.outcome };
    start(async () => {
      applyMove({ jobId: job.id, stage, outcome });
      const result = await moveJobAction(job.id, stage, outcome);
      if (!result.ok) return void toast.error(result.error);
      toast(`Moved to ${stageLabel(stage, outcome)}`, {
        action: {
          label: "Undo",
          onClick: () => void moveJobAction(job.id, previous.stage, previous.outcome),
        },
      });
    });
  }

  function onDragStart(e: DragStartEvent) {
    suppressClick.current = true;
    setDragging(optimisticJobs.find((j) => j.id === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    setTimeout(() => (suppressClick.current = false), 0);
    const job = optimisticJobs.find((j) => j.id === e.active.id);
    const to = e.over?.id as Stage | undefined;
    if (job && to && to !== job.stage) move(job, to);
  }

  const byStage = (stage: Stage) => optimisticJobs.filter((j) => j.stage === stage);

  return (
    <>
      {/* Phones: pick a column. */}
      <div role="tablist" aria-label="Stage" className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:hidden">
        {STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            role="tab"
            aria-selected={mobileStage === stage}
            onClick={() => setMobileStage(stage)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium",
              mobileStage === stage ? "border-ink bg-ink text-bg" : "border-line-strong bg-surface text-ink-2",
            )}
          >
            <span aria-hidden className={cn("size-2 rounded-full", STAGE_BG[stage])} />
            {STAGE_META[stage].label}
            <span className={cn("tabular", mobileStage === stage ? "text-bg/70" : "text-ink-3")}>{byStage(stage).length}</span>
          </button>
        ))}
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Picked up ${label(optimisticJobs, active.id)}.`,
            onDragOver: ({ over }) => (over ? `Over ${STAGE_META[over.id as Stage].label}.` : "Not over a column."),
            onDragEnd: ({ active, over }) => (over ? `Moved ${label(optimisticJobs, active.id)} to ${STAGE_META[over.id as Stage].label}.` : "Dropped."),
            onDragCancel: () => "Move cancelled.",
          },
        }}
      >
        <div className="grid gap-3 md:grid-cols-5 md:gap-2.5 lg:gap-3">
          {STAGES.map((stage) => (
            <Column key={stage} stage={stage} count={byStage(stage).length} hiddenOnMobile={stage !== mobileStage}>
              {byStage(stage).map((job) => (
                <DraggableCard key={job.id} job={job} timeZone={timeZone} onMove={(s, o) => move(job, s, o)} suppressClick={suppressClick} dragDisabled={!wide} />
              ))}
            </Column>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{dragging ? <Card job={dragging} timeZone={timeZone} lifted /> : null}</DragOverlay>
      </DndContext>

      <CloseJobDialog
        open={Boolean(closing)}
        onOpenChange={(open) => !open && setClosing(null)}
        jobLabel={closing ? `${closing.title} at ${closing.company}` : ""}
        onPick={(outcome) => {
          if (closing) move(closing, "closed", outcome);
          setClosing(null);
        }}
      />
    </>
  );
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

function label(jobs: BoardJob[], id: string | number) {
  const job = jobs.find((j) => j.id === id);
  return job ? `${job.title} at ${job.company}` : "job";
}

function Column({ stage, count, hiddenOnMobile, children }: { stage: Stage; count: number; hiddenOnMobile: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${STAGE_META[stage].label}, ${count}`}
      className={cn(
        "flex min-h-40 flex-col rounded-lg transition-colors md:min-h-[60vh] md:bg-surface-2/60 md:p-2",
        isOver && "md:bg-surface-3 md:ring-2 md:ring-line-strong",
        hiddenOnMobile && "max-md:hidden",
      )}
    >
      <header className="mb-2 hidden items-center gap-2 px-1.5 pt-1 md:flex">
        <span aria-hidden className={cn("size-2 rounded-full", STAGE_BG[stage])} />
        <h2 className="text-sm font-semibold">{STAGE_META[stage].label}</h2>
        <span className="text-sm text-ink-3 tabular">{count}</span>
      </header>
      <div className="flex flex-col gap-2">{children}</div>
      {count === 0 ? <p className="px-2 py-6 text-center text-xs text-ink-3">{STAGE_META[stage].hint}</p> : null}
    </section>
  );
}

function DraggableCard({
  job,
  timeZone,
  onMove,
  suppressClick,
  dragDisabled,
}: {
  job: BoardJob;
  timeZone: string;
  onMove: (stage: Stage, outcome?: Outcome | null) => void;
  suppressClick: React.RefObject<boolean>;
  dragDisabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id, disabled: dragDisabled });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} aria-roledescription="Draggable job" className={cn("touch-manipulation rounded-md outline-none", isDragging && "opacity-30")}>
      <Card job={job} timeZone={timeZone} onMove={onMove} suppressClick={suppressClick} />
    </div>
  );
}

function Card({
  job,
  timeZone,
  lifted,
  onMove,
  suppressClick,
}: {
  job: BoardJob;
  timeZone: string;
  lifted?: boolean;
  onMove?: (stage: Stage, outcome?: Outcome | null) => void;
  suppressClick?: React.RefObject<boolean>;
}) {
  const router = useRouter();
  const pay = formatPay(job.payMin, job.payMax, job.payPeriod, job.currency);
  const where = formatWhere(job.location, job.workMode);
  return (
    <article
      className={cn(
        "group relative rounded-md border border-line bg-surface p-3 transition-shadow hover:border-line-strong",
        lifted && "rotate-1 shadow-pop",
        job.stage === "closed" && "opacity-75",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold">
            <Link
              href={`/jobs/${job.id}`}
              className="after:absolute after:inset-0"
              onClick={(e) => {
                if (suppressClick?.current) e.preventDefault();
              }}
              draggable={false}
            >
              {job.title}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-xs text-ink-2">{job.company}</p>
        </div>
        {onMove ? (
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label={`Move ${job.title}`}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className="relative z-10 -mt-1 -mr-1.5 flex size-7 shrink-0 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>Move to</MenuLabel>
              {STAGES.filter((s) => s !== "closed" && s !== job.stage).map((s) => (
                <MenuItem key={s} onSelect={() => onMove(s)} icon={<span className={cn("ml-1 size-2 rounded-full", STAGE_BG[s])} />}>
                  {STAGE_META[s].label}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem onSelect={() => onMove("closed")}>{job.stage === "closed" ? "Change outcome…" : "Close…"}</MenuItem>
              <MenuItem onSelect={() => router.push(`/jobs/${job.id}`)}>Open</MenuItem>
            </MenuContent>
          </Menu>
        ) : null}
      </div>

      {pay || where || job.excitement || job.warnings.length ? (
        <div className="mt-2 flex items-end gap-2">
          <div className="min-w-0 flex-1 text-xs text-ink-3">
            {pay ? <p className="truncate tabular">{pay}</p> : null}
            {where ? <p className="truncate">{where}</p> : null}
          </div>
          <span className="flex shrink-0 items-center gap-1.5 pb-0.5">
            {job.warnings.length ? (
              <span title={job.warnings.join("\n")} className="relative z-10 text-ink-3">
                <TriangleAlert className="size-3.5" aria-label={job.warnings.join(". ")} />
              </span>
            ) : null}
            <InterestPips value={job.excitement} />
          </span>
        </div>
      ) : null}

      {job.stage === "closed" ? (
        <p className="mt-2 text-xs font-medium text-ink-3">{stageLabel(job.stage, job.outcome)}</p>
      ) : job.nextEventAt || job.nextAction || job.nextActionDue ? (
        <div className="mt-2 border-t border-line pt-2">
          <NextThing job={job} timeZone={timeZone} wrap />
        </div>
      ) : null}
    </article>
  );
}
