"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { dismissLeadAction, restoreLeadAction, saveLeadAction, unsendLeadAction } from "@/actions/leads";
import { Button } from "@/components/ui/button";

export function LeadActions({ leadId, size = "md" }: { leadId: string; size?: "sm" | "md" }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex gap-2">
      <Button
        variant="ink"
        size={size}
        pending={pending}
        onClick={() =>
          start(async () => {
            const result = await saveLeadAction(leadId);
            if (!result.ok) return void toast.error(result.error);
            toast("Saved to your jobs", { action: { label: "Open", onClick: () => router.push(`/jobs/${result.data.jobId}`) } });
          })
        }
      >
        Save to my jobs
      </Button>
      <Button
        variant="ghost"
        size={size}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await dismissLeadAction(leadId);
            if (!result.ok) return void toast.error(result.error);
            toast("Dismissed", { action: { label: "Undo", onClick: () => void restoreLeadAction(leadId) } });
          })
        }
      >
        Dismiss
      </Button>
    </div>
  );
}

export function RestoreLeadButton({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" pending={pending} onClick={() => start(async () => void (await restoreLeadAction(leadId)))}>
      Restore
    </Button>
  );
}

export function UnsendLeadButton({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      pending={pending}
      onClick={() =>
        start(async () => {
          const result = await unsendLeadAction(leadId);
          toast(result.ok ? "Lead taken back" : result.error);
        })
      }
    >
      Take back
    </Button>
  );
}
