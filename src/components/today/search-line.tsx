import Link from "next/link";
import { STAGE_BG } from "@/components/stage";
import { cn } from "@/lib/cn";
import { STAGE_META, TRACK } from "@/lib/domain/stages";
import type { SearchStats } from "@/lib/domain/stats";

/**
 * The hero of Today: your whole search drawn as one line, with a count at
 * every stop. Each stop opens the pipeline filtered to that stage.
 */
export function SearchLine({ stats }: { stats: SearchStats }) {
  return (
    <section aria-label="Your pipeline">
      <ol className="grid grid-cols-4">
        {TRACK.map((stage, i) => {
          const count = stats.byStage[stage];
          const lit = count > 0;
          // An offer on the table is the one stop that gets the highlighter.
          const highlighted = stage === "offer" && lit;
          return (
            <li key={stage}>
              <Link href={`/jobs?view=list&stage=${stage}`} className="group flex flex-col items-center rounded-lg pt-1 pb-2 text-center outline-offset-2">
                <span
                  className={cn("text-3xl leading-none font-bold tabular sm:text-[44px]", lit ? "text-ink" : "text-ink-3/50")}
                  style={{ fontVariationSettings: '"wdth" 80' }}
                >
                  {count}
                  <span className="sr-only"> {STAGE_META[stage].label}</span>
                </span>
                {/* Each stop draws the half-segments either side of its dot, so the line always meets the dots. */}
                <span aria-hidden className="relative mt-4 flex h-6 w-full items-center justify-center sm:mt-5">
                  <span className={cn("absolute top-1/2 left-0 h-[3px] w-1/2 -translate-y-1/2 bg-line-strong", i === 0 && "hidden")} />
                  <span className={cn("absolute top-1/2 right-0 h-[3px] w-1/2 -translate-y-1/2 bg-line-strong", i === TRACK.length - 1 && "hidden")} />
                  <span
                    className={cn(
                      "relative rounded-full ring-4 ring-bg transition-transform duration-150 group-hover:scale-125",
                      highlighted ? "size-5 bg-highlight" : cn("size-3.5", lit ? STAGE_BG[stage] : "bg-line-strong"),
                    )}
                  />
                </span>
                <span aria-hidden className="mt-2.5 text-xs font-medium text-ink-2 group-hover:text-ink sm:text-sm">
                  {STAGE_META[stage].label}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      {stats.closed > 0 ? (
        <p className="mt-1 text-center text-xs text-ink-3">
          <Link href="/jobs?view=list&stage=closed" className="hover:text-ink hover:underline">
            {stats.closed} closed{stats.hired ? `, ${stats.hired} hired` : ""}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
