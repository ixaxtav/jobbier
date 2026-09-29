import { Skeleton } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex flex-col gap-10" aria-busy aria-label="Loading Today">
      <div>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-9 w-80 max-w-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-28" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
