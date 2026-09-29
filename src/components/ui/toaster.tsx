"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      offset={{ bottom: "24px" }}
      mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-md bg-ink px-4 py-3 text-sm text-bg shadow-pop sm:w-auto sm:min-w-80 font-sans",
          title: "font-medium",
          description: "text-bg/70",
          actionButton: "ml-auto shrink-0 rounded-sm bg-highlight px-2.5 py-1 text-xs font-semibold text-highlight-ink",
          cancelButton: "shrink-0 text-xs text-bg/70",
          error: "!bg-danger !text-white",
        },
      }}
    />
  );
}
