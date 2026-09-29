import { Skeleton } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading jobs">
      <div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="mt-2 h-4 w-24" />
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid gap-3 md:grid-cols-5">
        {[0, 1, 2, 3, 4].map((c) => (
          <div key={c} className="flex flex-col gap-2 rounded-lg md:bg-surface-2/60 md:p-2 max-md:[&:not(:first-child)]:hidden">
            <Skeleton className="h-5 w-24" />
            {[0, 1, 2].slice(0, 3 - (c % 3)).map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
