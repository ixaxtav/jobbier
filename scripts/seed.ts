/**
 * Fills an account with a realistic search so every screen has something to show.
 *
 *   npm run db:seed -- you@example.com [--friend friend@example.com]
 *
 * The friend sends the account two leads. If the friend doesn't exist it's
 * created with a random password (printed once). Local databases only, unless
 * SEED_ALLOW_REMOTE=1 — and on a remote database it refuses to touch an
 * account that already has jobs, so it can only ever fill an empty demo account.
 */
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "";
const isLocal = /localhost|127\.0\.0\.1/.test(url);
if (!isLocal && process.env.SEED_ALLOW_REMOTE !== "1") {
  console.error("seed: refusing to seed a non-local database (set SEED_ALLOW_REMOTE=1 to fill an empty demo account)");
  process.exit(1);
}
const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--friend") ?? "";
const friendEmail = (args.includes("--friend") ? args[args.indexOf("--friend") + 1] : "ana@example.com") ?? "";
if (!email || !friendEmail) {
  console.error("usage: npm run db:seed -- you@example.com [--friend friend@example.com]");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema, casing: "snake_case" });
const { users, jobs, events, activities, contacts, leads } = schema;

const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY);
const ahead = (d: number, hour = 14) => {
  const t = new Date(Date.now() + d * DAY);
  t.setUTCHours(hour + 4, 0, 0, 0); // ~hour in New York
  return t;
};
const dateKey = (d: number) => new Date(Date.now() + d * DAY).toISOString().slice(0, 10);

type Seed = Partial<schema.NewJob> & { company: string; title: string; stage: schema.Stage; addedDaysAgo: number };

const JOBS: Seed[] = [
  { company: "Linear", title: "Senior Fullstack Engineer", stage: "interviewing", furthestStage: "interviewing", location: "Remote, EU", workMode: "remote", payMin: 165000, payMax: 210000, excitement: 5, addedDaysAgo: 18, appliedAt: ago(16), stageChangedAt: ago(6), source: "Company site" },
  { company: "Vercel", title: "Design Engineer", stage: "offer", furthestStage: "offer", location: "New York, NY", workMode: "hybrid", payMin: 180000, payMax: 220000, excitement: 4, addedDaysAgo: 34, appliedAt: ago(30), stageChangedAt: ago(2), source: "Referral from Sam" },
  { company: "Figma", title: "Product Engineer, Editor", stage: "interviewing", furthestStage: "interviewing", location: "San Francisco, CA", workMode: "onsite", payMin: 170000, payMax: 240000, excitement: 4, addedDaysAgo: 25, appliedAt: ago(21), stageChangedAt: ago(12), nextAction: "Send thank-you note to Priya", nextActionDue: dateKey(0) },
  { company: "Stripe", title: "Frontend Engineer, Dashboard", stage: "applied", furthestStage: "applied", location: "Remote, US", workMode: "remote", payMin: 160000, payMax: 200000, excitement: 3, addedDaysAgo: 20, appliedAt: ago(19), stageChangedAt: ago(19) },
  { company: "Ramp", title: "Software Engineer, Growth", stage: "applied", furthestStage: "applied", location: "Miami, FL", workMode: "hybrid", payMin: 150000, payMax: 190000, excitement: 3, addedDaysAgo: 9, appliedAt: ago(8), stageChangedAt: ago(8), nextAction: "Ping the recruiter on LinkedIn", nextActionDue: dateKey(-2) },
  { company: "Notion", title: "Software Engineer, Web Platform", stage: "applied", furthestStage: "applied", location: "New York, NY", workMode: "hybrid", payMin: 155000, payMax: 205000, addedDaysAgo: 5, appliedAt: ago(4), stageChangedAt: ago(4) },
  { company: "Duolingo", title: "Senior Web Engineer", stage: "applied", furthestStage: "applied", location: "Pittsburgh, PA", workMode: "onsite", payMin: 90000, payMax: 110000, addedDaysAgo: 3, appliedAt: ago(2), stageChangedAt: ago(2) },
  { company: "Raycast", title: "Frontend Engineer", stage: "saved", furthestStage: "saved", location: "Remote", workMode: "remote", excitement: 5, addedDaysAgo: 6, source: "Hacker News" },
  { company: "Arc Browser", title: "Web Engineer", stage: "saved", furthestStage: "saved", location: "New York, NY", workMode: "onsite", excitement: 3, addedDaysAgo: 1 },
  { company: "Airbnb", title: "Senior Software Engineer, Guest", stage: "closed", furthestStage: "interviewing", outcome: "rejected", location: "Remote, US", workMode: "remote", payMin: 180000, payMax: 230000, addedDaysAgo: 45, appliedAt: ago(44), stageChangedAt: ago(10) },
  { company: "Shopify", title: "Staff Developer", stage: "closed", furthestStage: "applied", outcome: "ghosted", location: "Remote", workMode: "remote", addedDaysAgo: 50, appliedAt: ago(49), stageChangedAt: ago(15) },
  { company: "Plaid", title: "Software Engineer", stage: "closed", furthestStage: "applied", outcome: "rejected", location: "San Francisco, CA", workMode: "hybrid", addedDaysAgo: 40, appliedAt: ago(38), stageChangedAt: ago(25) },
];

async function main() {
  const [me] = await db.select().from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`);
  if (!me) throw new Error(`No user with email ${email}. Sign up first.`);

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.userId, me.id));
  if (count > 0 && !isLocal) throw new Error(`${email} already has ${count} jobs; the seed only fills empty accounts on a remote database.`);
  await db.delete(jobs).where(eq(jobs.userId, me.id));

  for (const seed of JOBS) {
    const { addedDaysAgo, ...values } = seed;
    const [job] = await db
      .insert(jobs)
      .values({ ...values, userId: me.id, createdAt: ago(addedDaysAgo), updatedAt: values.stageChangedAt ?? ago(addedDaysAgo), stageChangedAt: values.stageChangedAt ?? ago(addedDaysAgo) })
      .returning();
    await db.insert(activities).values({ userId: me.id, jobId: job.id, kind: "created", meta: { stage: "saved" }, createdAt: ago(addedDaysAgo) });
    if (job.stage !== "saved") {
      await db.insert(activities).values({ userId: me.id, jobId: job.id, kind: "stage", meta: { from: "saved", to: job.stage, outcome: job.outcome }, createdAt: job.stageChangedAt });
    }

    if (job.company === "Linear") {
      await db.insert(events).values([
        { userId: me.id, jobId: job.id, kind: "interview", title: "Technical interview", startsAt: ahead(1, 11), durationMinutes: 60, location: "https://meet.google.com/abc-defg-hij", notes: "Pairing session. Brush up on sync engines." },
        { userId: me.id, jobId: job.id, kind: "call", title: "Recruiter screen", startsAt: ago(6), durationMinutes: 30 },
      ]);
      await db.insert(contacts).values({ userId: me.id, jobId: job.id, name: "Jordan Lee", role: "Recruiter", email: "jordan@linear.example" });
      await db.insert(activities).values({ userId: me.id, jobId: job.id, kind: "note", body: "Recruiter screen went well. Team is 8 people, ships weekly. Next: technical pairing round.", createdAt: ago(6) });
    }
    if (job.company === "Figma") {
      await db.insert(events).values({ userId: me.id, jobId: job.id, kind: "assessment", title: "Take-home due", startsAt: ahead(4, 17), durationMinutes: 15 });
      await db.insert(contacts).values({ userId: me.id, jobId: job.id, name: "Priya Shah", role: "Hiring manager" });
    }
    if (job.company === "Vercel") {
      await db.insert(events).values({ userId: me.id, jobId: job.id, kind: "deadline", title: "Offer expires", startsAt: ahead(6, 17), durationMinutes: 15 });
      await db.insert(activities).values({ userId: me.id, jobId: job.id, kind: "note", body: "Offer: $205K base + equity. Asked for a week to decide.", createdAt: ago(2) });
    }
  }

  // A friend who sends a lead.
  let [friend] = await db.select().from(users).where(sql`lower(${users.email}) = ${friendEmail.toLowerCase()}`);
  let friendPassword: string | null = null;
  if (!friend) {
    friendPassword = randomBytes(9).toString("base64url");
    [friend] = await db.insert(users).values({ name: "Ana Rivera", email: friendEmail, passwordHash: await hashPassword(friendPassword) }).returning();
  }
  await db.delete(leads).where(eq(leads.toUserId, me.id));
  await db.insert(leads).values([
    { fromUserId: friend.id, toUserId: me.id, company: "Supabase", title: "Developer Experience Engineer", url: "https://supabase.com/careers", location: "Remote", workMode: "remote", payMin: 140000, payMax: 180000, note: "This team is great, and they're hiring fast. Want an intro?", createdAt: ago(1) },
    { fromUserId: friend.id, toUserId: me.id, company: "Resend", title: "Frontend Engineer", location: "San Francisco, CA", workMode: "onsite", note: "Saw this on their blog.", createdAt: ago(3) },
  ]);

  console.log(`seed: added ${JOBS.length} jobs and 2 leads for ${email} from ${friendEmail}`);
  if (friendPassword) console.log(`seed: created ${friendEmail} with password ${friendPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
