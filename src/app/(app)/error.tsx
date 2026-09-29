"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 py-16">
      <h1 className="text-2xl font-bold">This page didn&rsquo;t load</h1>
      <p className="text-ink-2">
        Something went wrong on our side, and nothing you entered was lost. Try again, and if it keeps happening, go back to Today.
      </p>
      {error.digest ? <p className="text-xs text-ink-3">Reference: {error.digest}</p> : null}
      <div className="flex gap-2">
        <Button variant="ink" icon={<RotateCcw />} onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/today">Go to Today</ButtonLink>
      </div>
    </div>
  );
}
