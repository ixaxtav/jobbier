"use client";

import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { clearNextActionAction, moveJobAction } from "@/actions/jobs";
import { Monogram } from "@/components/monogram";
import type { AttentionItem } from "@/lib/domain/attention";
import { cn } from "@/lib/cn";

type Item = AttentionItem & { nextActionDue?: string | null; nextAction?: string | null };

export function AttentionList({ items }: { items: Item[] }) {
  const [visible, hide] = useOptimistic(items, (state, jobId: string) => state.filter((i) => i.jobId !== jobId));
  const [, start] = useTransition();

  function act(item: Item, run: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    start(async () => {
      hide(item.jobId);
      const result = await run();
      if (!result.ok) toast.error(result.error ?? "Something went wrong");
      else toast(done);
    });
  }

  if (visible.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-5 text-sm text-ink-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-surface-2">
          <Check className="size-4" />
        </span>
        Nothing needs you right now. Follow-ups you set and quiet applications show up here.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {visible.map((item) => (
        <li key={`${item.kind}-${item.jobId}`} className="group relative flex items-center gap-3 px-4 py-3.5">
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-0 left-0 w-[3px]",
              item.kind === "overdue" || item.kind === "due-today" || item.kind === "offer" ? "bg-highlight" : "bg-transparent",
            )}
          />
          <Monogram name={item.company} />
          <div className="min-w-0 flex-1">
            <Link href={`/jobs/${item.jobId}`} className="block font-medium after:absolute after:inset-0">
              {item.message}
            </Link>
            <p className="text-sm text-ink-2 sm:truncate">
              {item.title} at {item.company}
              <span className={cn("block sm:ml-2 sm:inline", item.kind === "overdue" ? "font-medium text-danger" : "text-ink-3")}>{item.detail}</span>
            </p>
          </div>
          <div className="relative z-10 flex shrink-0 items-center gap-1">
            {item.kind === "overdue" || item.kind === "due-today" ? (
              <QuickButton onClick={() => act(item, () => clearNextActionAction(item.jobId), "Marked done")}>Done</QuickButton>
            ) : item.kind === "stale" ? (
              <QuickButton onClick={() => act(item, () => moveJobAction(item.jobId, "closed", "ghosted"), "Closed as no reply")}>
                No reply
              </QuickButton>
            ) : item.kind === "excited" ? (
              <QuickButton onClick={() => act(item, () => moveJobAction(item.jobId, "applied"), "Marked as applied")}>Applied</QuickButton>
            ) : null}
            <ChevronRight aria-hidden className="size-4 text-ink-3 max-sm:hidden" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function QuickButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 rounded-sm border border-line-strong bg-surface px-2.5 text-xs font-medium text-ink-2 hover:border-ink-3 hover:text-ink"
    >
      {children}
    </button>
  );
}
