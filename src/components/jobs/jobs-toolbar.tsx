"use client";

import { Columns3, List, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { STAGE_BG } from "@/components/stage";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { STAGE_META, STAGES } from "@/lib/domain/stages";

/** Search, view switch, and (in list view) stage filter and sort. All state lives in the URL. */
export function JobsToolbar({ view }: { view: "board" | "list" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const input = useRef<HTMLInputElement>(null);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Debounced search.
  useEffect(() => {
    if (query === (params.get("q") ?? "")) return;
    const t = setTimeout(() => update({ q: query.trim() || null }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // "/" focuses search.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      e.preventDefault();
      input.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const stage = params.get("stage");
  const sort = params.get("sort") ?? "updated";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1 sm:max-w-sm">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <label htmlFor="job-search" className="sr-only">
            Search jobs
          </label>
          <input
            ref={input}
            id="job-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search jobs"
            className="h-10 w-full rounded-md border border-line-strong bg-surface pr-16 pl-9 text-base outline-none hover:border-ink-3 focus:border-ink focus:ring-3 focus:ring-ink/10 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          <span className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1.5 text-ink-3">
            {pending ? <Spinner className="size-3.5" /> : null}
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="rounded-sm p-0.5 hover:text-ink">
                <X className="size-4" />
              </button>
            ) : (
              <kbd className="hidden rounded-[4px] border border-line px-1.5 text-2xs sm:inline">/</kbd>
            )}
          </span>
        </div>

        <div role="radiogroup" aria-label="View" className="flex rounded-md bg-surface-2 p-1">
          {(
            [
              ["board", "Board", Columns3],
              ["list", "List", List],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={view === value}
              onClick={() => update({ view: value === "board" ? null : value, stage: value === "board" ? null : stage, sort: value === "board" ? null : sort === "updated" ? null : sort })}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium",
                view === value ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.12)]" : "text-ink-2 hover:text-ink",
              )}
            >
              <Icon aria-hidden className="size-4" />
              <span className="max-sm:sr-only">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {view === "list" ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="-mx-4 flex flex-1 gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <FilterChip active={!stage} onClick={() => update({ stage: null })}>
              All
            </FilterChip>
            {STAGES.map((s) => (
              <FilterChip key={s} active={stage === s} onClick={() => update({ stage: stage === s ? null : s })}>
                <span aria-hidden className={cn("size-2 rounded-full", STAGE_BG[s])} />
                {STAGE_META[s].label}
              </FilterChip>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <span className="max-sm:sr-only">Sort by</span>
            <select
              value={sort}
              onChange={(e) => update({ sort: e.target.value === "updated" ? null : e.target.value })}
              className="h-8 rounded-sm border border-line-strong bg-surface px-2 text-sm text-ink outline-none focus:border-ink"
            >
              <option value="updated">Last updated</option>
              <option value="applied">Date applied</option>
              <option value="excitement">Interest</option>
              <option value="company">Company A–Z</option>
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium",
        active ? "border-ink bg-ink text-bg" : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
