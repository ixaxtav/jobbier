import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** An empty screen is an invitation to act: say what goes here and how to get it there. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong px-6 py-10 sm:items-center sm:text-center", className)}>
      {icon ? (
        <span aria-hidden className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink-2 [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <div className="max-w-md">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-ink-2">{body}</p>
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
