import { Skeleton } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading job">
      <Skeleton className="h-4 w-14" />
      <div className="flex items-start gap-4">
        <Skeleton className="size-14 rounded-lg max-sm:hidden" />
        <div className="flex-1">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="mt-2 h-5 w-40" />
        </div>
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
    </div>
  );
}
