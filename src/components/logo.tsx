import { cn } from "@/lib/cn";

/** Three stops on a line, the last one highlighted — the whole product in one mark. */
export function LogoMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  const tile = inverted ? "var(--bg)" : "var(--ink)";
  const mark = inverted ? "var(--ink)" : "var(--bg)";
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" fill={tile} />
      <path d="M7 20.5h18" stroke={mark} strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 20.5h11" stroke={mark} strokeWidth="2" strokeLinecap="round" />
      <circle cx="7.5" cy="20.5" r="2.5" fill={mark} />
      <circle cx="16" cy="20.5" r="2.5" fill={mark} />
      <circle cx="24.5" cy="20.5" r="4" fill="var(--highlight)" />
    </svg>
  );
}

export function Wordmark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark inverted={inverted} />
      <span className="text-[19px] font-bold tracking-[-0.03em]" style={{ fontVariationSettings: '"wdth" 88' }}>
        Jobbier
      </span>
    </span>
  );
}
