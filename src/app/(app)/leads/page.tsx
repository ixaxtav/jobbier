import { ExternalLink, Inbox, Send, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { listIncomingLeads, listSentLeads } from "@/data/leads";
import { requireUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/dates";
import { fitWarnings } from "@/lib/domain/fit";
import { displayHost, formatPay, formatWhere } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LeadActions, RestoreLeadButton, UnsendLeadButton } from "@/components/leads/lead-actions";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const user = await requireUser();
  const tab = (await searchParams).tab === "sent" ? "sent" : "inbox";
  const [incoming, sent] = await Promise.all([listIncomingLeads(user.id), listSentLeads(user.id)]);
  const pending = incoming.filter((l) => l.lead.status === "pending");
  const answered = incoming.filter((l) => l.lead.status !== "pending");
  const now = new Date();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Leads</h1>
          <p className="mt-1 max-w-xl text-ink-2">Jobs your friends think you’d like. Send one back from any job’s page.</p>
        </div>
        <nav aria-label="Leads" className="flex gap-1 rounded-md bg-surface-2 p-1 text-sm">
          <TabLink href="/leads" active={tab === "inbox"}>
            For you{pending.length ? <span className="ml-1.5 rounded-full bg-highlight px-1.5 text-2xs font-semibold text-highlight-ink">{pending.length}</span> : null}
          </TabLink>
          <TabLink href="/leads?tab=sent" active={tab === "sent"}>
            You sent
          </TabLink>
        </nav>
      </header>

      {tab === "inbox" ? (
        incoming.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title="No leads yet"
            body="When a friend spots a job for you in Jobbier, it lands here. You can save it to your jobs in one tap, or dismiss it."
          />
        ) : (
          <div className="flex flex-col gap-10">
            {pending.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {pending.map(({ lead, fromName }) => {
                  const pay = formatPay(lead.payMin, lead.payMax, lead.payPeriod);
                  const warnings = fitWarnings(lead, user);
                  return (
                    <li key={lead.id} className="rounded-lg border border-line bg-surface p-5">
                      <p className="text-sm text-ink-2">
                        <span className="font-medium text-ink">{fromName ?? "A friend"}</span> sent this {formatRelative(lead.createdAt, now)}
                      </p>
                      <h2 className="mt-2 text-lg font-semibold">
                        {lead.title} <span className="font-normal text-ink-2">at {lead.company}</span>
                      </h2>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
                        {formatWhere(lead.location, lead.workMode) ? <span>{formatWhere(lead.location, lead.workMode)}</span> : null}
                        {pay ? <span className="tabular">{pay}</span> : null}
                        {lead.url ? (
                          <a href={lead.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline decoration-line-strong underline-offset-4 hover:text-ink">
                            {displayHost(lead.url)} <ExternalLink aria-hidden className="size-3.5" />
                          </a>
                        ) : null}
                      </p>
                      {lead.note ? <blockquote className="mt-3 border-l-2 border-highlight pl-3 text-ink">{lead.note}</blockquote> : null}
                      {warnings.length ? (
                        <ul className="mt-3 flex flex-col gap-1">
                          {warnings.map((w) => (
                            <li key={w} className="flex items-center gap-1.5 text-sm text-ink-2">
                              <TriangleAlert aria-hidden className="size-4 text-ink-3" />
                              {w}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="mt-4">
                        <LeadActions leadId={lead.id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-ink-2">You’ve gone through every lead.</p>
            )}

            {answered.length > 0 ? (
              <section aria-labelledby="answered">
                <h2 id="answered" className="mb-3 text-sm font-semibold text-ink-2">
                  Earlier
                </h2>
                <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                  {answered.map(({ lead, fromName }) => (
                    <li key={lead.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {lead.title} <span className="font-normal text-ink-2">at {lead.company}</span>
                        </p>
                        <p className="text-xs text-ink-3">
                          From {fromName ?? "a friend"}, {lead.status === "saved" ? "saved" : "dismissed"} {formatRelative(lead.respondedAt ?? lead.createdAt, now)}
                        </p>
                      </div>
                      {lead.status === "saved" && lead.jobId ? (
                        <Link href={`/jobs/${lead.jobId}`} className="text-sm font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                          Open job
                        </Link>
                      ) : lead.status === "dismissed" ? (
                        <RestoreLeadButton leadId={lead.id} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )
      ) : sent.length === 0 ? (
        <EmptyState
          icon={<Send />}
          title="You haven’t sent any leads"
          body="Found a job that’s more a friend’s thing than yours? Add it, then use “Send to a friend” on its page."
        />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {sent.map(({ lead, toName }) => (
            <li key={lead.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {lead.title} <span className="font-normal text-ink-2">at {lead.company}</span>
                </p>
                <p className="text-xs text-ink-3">
                  To {toName}, {formatRelative(lead.createdAt, now)}
                </p>
              </div>
              <span className={cn("text-xs font-medium", lead.status === "saved" ? "text-good" : "text-ink-3")}>
                {lead.status === "pending" ? "Not seen yet" : lead.status === "saved" ? "They saved it" : "Passed"}
              </span>
              {lead.status === "pending" ? <UnsendLeadButton leadId={lead.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex h-8 flex-1 items-center justify-center rounded-sm px-3 font-medium whitespace-nowrap", active ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.12)]" : "text-ink-2 hover:text-ink")}
    >
      {children}
    </Link>
  );
}
