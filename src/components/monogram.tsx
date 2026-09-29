import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

/** Neutral company tile. Deliberately colourless — colour in Jobbier means stage. */
export function Monogram({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-line bg-surface-2 font-semibold text-ink-2",
        size === "sm" && "size-7 rounded-sm text-2xs",
        size === "md" && "size-9 rounded-md text-xs",
        size === "lg" && "size-14 rounded-lg text-lg",
        className,
      )}
      style={{ fontVariationSettings: '"wdth" 85' }}
    >
      {initials(name)}
    </span>
  );
}
