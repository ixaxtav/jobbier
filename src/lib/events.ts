import type { EventKind } from "@/db/schema";

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  interview: "Interview",
  call: "Call",
  assessment: "Take-home or test",
  deadline: "Deadline",
  other: "Other",
};

export const EVENT_KINDS = Object.keys(EVENT_KIND_LABEL) as EventKind[];
