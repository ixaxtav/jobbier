"use client";

import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Wider dialogs for forms with two columns. */
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
};

/**
 * Centered on larger screens, a bottom sheet on phones — the one dialog pattern
 * used everywhere (JobCore mixed toasts-with-buttons, jQuery modals and side panels).
 */
export function Dialog({ open, onOpenChange, title, description, children, size = "md", footer }: DialogProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in dark:bg-black/60" />
        <D.Content
          className={cn(
            "fixed z-50 flex max-h-[92dvh] w-full flex-col bg-surface shadow-dialog outline-none",
            "inset-x-0 bottom-0 rounded-t-lg data-[state=open]:animate-sheet-in",
            "sm:inset-x-auto sm:top-[8vh] sm:bottom-auto sm:left-1/2 sm:max-h-[84vh] sm:-translate-x-1/2 sm:rounded-lg sm:data-[state=open]:animate-pop-in",
            size === "sm" && "sm:max-w-md",
            size === "md" && "sm:max-w-xl",
            size === "lg" && "sm:max-w-2xl",
          )}
          onOpenAutoFocus={(e) => {
            // Focus the first field, not the close button.
            const first = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]), textarea, select");
            if (first) {
              e.preventDefault();
              first.focus();
            }
          }}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <header className="flex items-start gap-4 px-5 pt-4 pb-3 sm:px-6 sm:pt-5">
            <div className="min-w-0 flex-1">
              <D.Title className="text-lg font-semibold tracking-tight">{title}</D.Title>
              {description ? <D.Description className="mt-0.5 text-sm text-ink-2">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close className="-mt-1 -mr-2 inline-flex size-9 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close">
              <X className="size-[18px]" />
            </D.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
          {footer ? (
            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-line px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:flex-row sm:justify-end sm:px-6 sm:pb-3">
              {footer}
            </footer>
          ) : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/**
 * Action bar pinned to the bottom of a scrolling dialog form. Sticky offsets
 * are measured inside the body's padding, so it sits at -bottom-5 to cancel it.
 */
export function DialogActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky -bottom-5 z-10 -mx-5 -mb-5 flex items-center gap-2 border-t border-line bg-surface px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:-mx-6 sm:px-6 sm:pb-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
