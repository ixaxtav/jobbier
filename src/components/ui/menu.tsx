"use client";

import { DropdownMenu as M } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ children, align = "end", className }: { children: ReactNode; align?: "start" | "end"; className?: string }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          "z-50 min-w-48 rounded-md border border-line bg-surface p-1 shadow-pop data-[state=open]:animate-pop-in",
          className,
        )}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({
  className,
  destructive,
  icon,
  children,
  ...props
}: ComponentProps<typeof M.Item> & { destructive?: boolean; icon?: ReactNode }) {
  return (
    <M.Item
      className={cn(
        "flex h-9 cursor-default items-center gap-2.5 rounded-sm px-2.5 text-sm outline-none select-none data-disabled:opacity-40 data-highlighted:bg-surface-2 [&_svg]:size-4 [&_svg]:text-ink-3",
        destructive && "text-danger data-highlighted:bg-danger-soft [&_svg]:text-danger",
        className,
      )}
      {...props}
    >
      {props.asChild ? (
        children
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </M.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-2.5 pt-2 pb-1 text-xs text-ink-3">{children}</M.Label>;
}

export function MenuSeparator({ className }: { className?: string }) {
  return <M.Separator className={cn("my-1 h-px bg-line", className)} />;
}
