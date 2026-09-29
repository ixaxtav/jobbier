"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAddJob } from "./add-job";

export function AddJobButton({ className, children = "Add job" }: { className?: string; children?: React.ReactNode }) {
  const addJob = useAddJob();
  return (
    <Button variant="primary" icon={<Plus strokeWidth={2.5} />} onClick={() => addJob.open()} className={className}>
      {children}
    </Button>
  );
}
