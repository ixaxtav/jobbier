import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ink";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-100 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<Variant, string> = {
  // The highlighter: reserved for the one main action on a screen.
  primary: "bg-highlight text-highlight-ink shadow-[inset_0_-1.5px_0_rgb(0_0_0/0.12)] hover:brightness-[0.97]",
  ink: "bg-ink text-bg hover:opacity-90",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-8 rounded-sm px-2.5 text-sm [&_svg]:size-4",
  md: "h-10 rounded-md px-3.5 text-sm [&_svg]:size-4",
  lg: "h-12 rounded-md px-5 text-base [&_svg]:size-5",
};

type Common = { variant?: Variant; size?: Size; icon?: ReactNode; className?: string };

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  pending,
  className,
  children,
  disabled,
  ...props
}: Common & ComponentProps<"button"> & { pending?: boolean }) {
  return (
    <button
      type="button"
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  ...props
}: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}

/** Square icon-only button. Always needs a label for screen readers. */
export function IconButton({
  label,
  className,
  children,
  size = "md",
  ...props
}: ComponentProps<"button"> & { label: string; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40",
        size === "sm" ? "size-7 [&_svg]:size-4" : "size-9 [&_svg]:size-[18px]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
