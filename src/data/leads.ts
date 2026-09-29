import "server-only";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { leads, users } from "@/db/schema";
import { createJob, getJob, NotFoundError } from "./jobs";

const sender = alias(users, "sender");
const recipient = alias(users, "recipient");

/** Everyone else in this Jobbier — it's a small, invite-only group, so everyone can send leads to everyone. */
export async function listFriends(userId: string) {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(ne(users.id, userId))
    .orderBy(sql`lower(${users.name})`);
}

export async function listIncomingLeads(userId: string) {
  return db
    .select({ lead: leads, fromName: sender.name })
    .from(leads)
    .leftJoin(sender, eq(sender.id, leads.fromUserId))
    .where(eq(leads.toUserId, userId))
    .orderBy(sql`${leads.status} = 'pending' desc`, desc(leads.createdAt))
    .limit(200);
}

export async function listSentLeads(userId: string) {
  return db
    .select({ lead: leads, toName: recipient.name })
    .from(leads)
    .innerJoin(recipient, eq(recipient.id, leads.toUserId))
    .where(eq(leads.fromUserId, userId))
    .orderBy(desc(leads.createdAt))
    .limit(200);
}

export async function countPendingLeads(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(eq(leads.toUserId, userId), eq(leads.status, "pending")));
  return row.n;
}

/** Snapshot one of your jobs into a lead for each friend. Returns how many were sent. */
export async function sendLeads(userId: string, jobId: string, toUserIds: string[], note: string | null) {
  const job = await getJob(userId, jobId);
  if (!job) throw new NotFoundError("Job not found");
  const recipients = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, toUserIds), ne(users.id, userId)));
  if (recipients.length === 0) return 0;

  await db.insert(leads).values(
    recipients.map((r) => ({
      fromUserId: userId,
      toUserId: r.id,
      company: job.company,
      title: job.title,
      url: job.url,
      location: job.location,
      workMode: job.workMode,
      payMin: job.payMin,
      payMax: job.payMax,
      payPeriod: job.payPeriod,
      description: job.description,
      note,
    })),
  );
  return recipients.length;
}

async function ownedIncomingLead(userId: string, leadId: string) {
  const [row] = await db
    .select({ lead: leads, fromName: sender.name })
    .from(leads)
    .leftJoin(sender, eq(sender.id, leads.fromUserId))
    .where(and(eq(leads.id, leadId), eq(leads.toUserId, userId)))
    .limit(1);
  if (!row) throw new NotFoundError("Lead not found");
  return row;
}

export async function saveLead(userId: string, leadId: string): Promise<{ jobId: string | null }> {
  const { lead, fromName } = await ownedIncomingLead(userId, leadId);
  if (lead.status === "saved") return { jobId: lead.jobId };

  // Claim the lead first: one conditional UPDATE, so a double tap can't create two jobs.
  const [claimed] = await db
    .update(leads)
    .set({ status: "saved", respondedAt: new Date() })
    .where(and(eq(leads.id, lead.id), eq(leads.toUserId, userId), ne(leads.status, "saved")))
    .returning({ id: leads.id });
  if (!claimed) {
    const [row] = await db.select({ jobId: leads.jobId }).from(leads).where(eq(leads.id, lead.id));
    return { jobId: row?.jobId ?? null };
  }

  try {
    const job = await createJob(
      userId,
      {
        company: lead.company,
        title: lead.title,
        url: lead.url,
        location: lead.location,
        workMode: lead.workMode,
        payMin: lead.payMin,
        payMax: lead.payMax,
        payPeriod: lead.payPeriod,
        currency: "USD",
        description: lead.description,
        source: fromName ? `Lead from ${fromName}` : "Lead from a friend",
        excitement: null,
      },
      { leadFrom: fromName ?? "a friend" },
    );
    await db.update(leads).set({ jobId: job.id }).where(eq(leads.id, lead.id));
    return { jobId: job.id };
  } catch (error) {
    // Put the lead back so it can be saved again.
    await db.update(leads).set({ status: lead.status, respondedAt: null }).where(eq(leads.id, lead.id));
    throw error;
  }
}

export async function dismissLead(userId: string, leadId: string) {
  const { lead } = await ownedIncomingLead(userId, leadId);
  await db.update(leads).set({ status: "dismissed", respondedAt: new Date() }).where(eq(leads.id, lead.id));
}

export async function restoreLead(userId: string, leadId: string) {
  const { lead } = await ownedIncomingLead(userId, leadId);
  if (lead.status !== "dismissed") return;
  await db.update(leads).set({ status: "pending", respondedAt: null }).where(eq(leads.id, lead.id));
}

export async function unsendLead(userId: string, leadId: string) {
  await db.delete(leads).where(and(eq(leads.id, leadId), eq(leads.fromUserId, userId), eq(leads.status, "pending")));
}
