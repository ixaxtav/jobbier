import Link from "next/link";
import type { Lead } from "@/db/schema";
import { LeadActions } from "./lead-actions";

export function LeadsPreview({ leads, total }: { leads: { lead: Lead; fromName: string | null }[]; total: number }) {
  return (
    <section aria-labelledby="leads-preview" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="leads-preview" className="text-sm font-semibold text-ink-2">
          From friends
        </h2>
        {total > leads.length ? (
          <Link href="/leads" className="text-xs text-ink-3 hover:text-ink hover:underline">
            See all {total}
          </Link>
        ) : null}
      </div>
      <ul className="flex flex-col gap-2">
        {leads.map(({ lead, fromName }) => (
          <li key={lead.id} className="rounded-lg border border-line bg-surface p-4">
            <p className="flex items-center gap-1.5 text-xs text-ink-2">
              <span aria-hidden className="size-1.5 rounded-full bg-highlight ring-2 ring-highlight/30" />
              {fromName ?? "A friend"} sent you
            </p>
            <p className="mt-0.5 font-medium">
              {lead.title} <span className="font-normal text-ink-2">at {lead.company}</span>
            </p>
            {lead.note ? <p className="mt-1.5 line-clamp-2 text-sm text-ink-2">“{lead.note}”</p> : null}
            <div className="mt-3">
              <LeadActions leadId={lead.id} size="sm" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
