import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { activities, contacts, documents, events, jobs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

/** Drop internal ownership columns from exported rows. */
function strip<T extends Record<string, unknown>>(row: T, ...keys: string[]) {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));
}

/** Everything you've put into Jobbier. JSON for a full backup, CSV (jobs only) for spreadsheets. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in to export", { status: 401 });
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const stamp = new Date().toISOString().slice(0, 10);

  const myJobs = await db.select().from(jobs).where(eq(jobs.userId, user.id)).orderBy(jobs.createdAt);

  if (format === "csv") {
    const columns = ["company", "title", "stage", "outcome", "location", "workMode", "payMin", "payMax", "payPeriod", "currency", "excitement", "source", "url", "appliedAt", "nextAction", "nextActionDue", "createdAt"] as const;
    const cell = (v: unknown) => {
      if (v == null) return "";
      const s = v instanceof Date ? v.toISOString() : String(v);
      // Quote everything and neutralise spreadsheet formulas.
      return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
    };
    const csv = [columns.join(","), ...myJobs.map((j) => columns.map((c) => cell(j[c])).join(","))].join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="jobbier-jobs-${stamp}.csv"`,
      },
    });
  }

  const [myEvents, myActivities, myContacts, myDocuments] = await Promise.all([
    db.select().from(events).where(eq(events.userId, user.id)),
    db.select().from(activities).where(eq(activities.userId, user.id)),
    db.select().from(contacts).where(eq(contacts.userId, user.id)),
    db.select({ id: documents.id, name: documents.name, kind: documents.kind, contentType: documents.contentType, size: documents.size, createdAt: documents.createdAt }).from(documents).where(eq(documents.userId, user.id)),
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    user: { name: user.name, email: user.email, timeZone: user.timeZone },
    jobs: myJobs.map((j) => ({
      ...strip(j, "userId"),
      events: myEvents.filter((e) => e.jobId === j.id).map((e) => strip(e, "userId", "jobId")),
      contacts: myContacts.filter((c) => c.jobId === j.id).map((c) => strip(c, "userId", "jobId")),
      log: myActivities.filter((a) => a.jobId === j.id).map((a) => strip(a, "userId", "jobId")),
    })),
    files: myDocuments,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="jobbier-export-${stamp}.json"`,
    },
  });
}
