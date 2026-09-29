// Data-layer tests against a real Postgres. Run with: npm run test:db
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { User } from "@/db/schema";

describe.runIf(process.env.DB_TESTS)("data layer", async () => {
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const jobsData = await import("@/data/jobs");
  const details = await import("@/data/job-details");
  const leadsData = await import("@/data/leads");
  const usersData = await import("@/data/users");

  let alice: User;
  let bob: User;

  beforeAll(async () => {
    await db.delete(schema.users);
    [alice] = await db.insert(schema.users).values({ name: "Alice", email: "alice@test.dev", passwordHash: "x" }).returning();
    [bob] = await db.insert(schema.users).values({ name: "Bob", email: "bob@test.dev", passwordHash: "x" }).returning();
  });

  afterAll(async () => {
    await db.delete(schema.users);
  });

  const base = {
    company: "Acme",
    title: "Engineer",
    url: null,
    location: null,
    workMode: null,
    payMin: null,
    payMax: null,
    payPeriod: "year" as const,
    currency: "USD",
    description: null,
    source: null,
    excitement: null,
  };

  it("keeps each person's jobs private", async () => {
    const job = await jobsData.createJob(alice.id, base);
    expect(await jobsData.getJob(bob.id, job.id)).toBeNull();
    await expect(jobsData.updateJob(bob.id, job.id, { ...base, title: "Hacked" })).rejects.toThrow(jobsData.NotFoundError);
    await expect(jobsData.moveJob(bob.id, job.id, "applied", null)).rejects.toThrow(jobsData.NotFoundError);
    await expect(details.addNote(bob.id, job.id, "hi")).rejects.toThrow(jobsData.NotFoundError);
    await jobsData.deleteJob(bob.id, job.id).catch(() => undefined);
    expect(await jobsData.getJob(alice.id, job.id)).not.toBeNull();
    expect(await jobsData.listJobs(bob.id)).toHaveLength(0);
  });

  it("moves stages with history and keeps the follow-up through close/reopen", async () => {
    const job = await jobsData.createJob(alice.id, { ...base, stage: "applied" });
    expect(job.appliedAt).not.toBeNull();
    await jobsData.setNextAction(alice.id, job.id, "Email Sam", "2026-10-01");
    await jobsData.moveJob(alice.id, job.id, "closed", "ghosted");
    await jobsData.moveJob(alice.id, job.id, "applied", null);
    const detail = await jobsData.getJobDetail(alice.id, job.id);
    expect(detail?.job).toMatchObject({ stage: "applied", outcome: null, nextAction: "Email Sam" });
    expect(detail?.activities.filter((a) => a.kind === "stage")).toHaveLength(2);
  });

  it("only deletes notes, never stage history, and only your own", async () => {
    const job = await jobsData.createJob(alice.id, base);
    await details.addNote(alice.id, job.id, "private thought");
    const [note] = (await jobsData.getJobDetail(alice.id, job.id))!.activities.filter((a) => a.kind === "note");
    const [created] = (await jobsData.getJobDetail(alice.id, job.id))!.activities.filter((a) => a.kind === "created");
    await details.deleteNote(bob.id, note.id);
    await details.deleteNote(alice.id, created.id);
    expect((await jobsData.getJobDetail(alice.id, job.id))!.activities).toHaveLength(2);
    await details.deleteNote(alice.id, note.id);
    expect((await jobsData.getJobDetail(alice.id, job.id))!.activities).toHaveLength(1);
  });

  it("saves a lead once, even when asked twice at the same time", async () => {
    const job = await jobsData.createJob(alice.id, { ...base, company: "Globex" });
    expect(await leadsData.sendLeads(alice.id, job.id, [bob.id, alice.id], "for you")).toBe(1);
    const [{ lead }] = await leadsData.listIncomingLeads(bob.id);
    await expect(leadsData.saveLead(alice.id, lead.id)).rejects.toThrow(jobsData.NotFoundError);
    const [a, b] = await Promise.all([leadsData.saveLead(bob.id, lead.id), leadsData.saveLead(bob.id, lead.id)]);
    const bobsJobs = await jobsData.listJobs(bob.id);
    expect(bobsJobs.filter((j) => j.company === "Globex")).toHaveLength(1);
    expect([a.jobId, b.jobId].filter(Boolean).length).toBeGreaterThanOrEqual(1);
    expect(bobsJobs[0].source).toBe("Lead from Alice");
  });

  it("locks sign-in after 8 attempts and starts counting again after the lock", async () => {
    for (let i = 0; i < 8; i++) expect(await usersData.claimLoginAttempt(bob.id)).toBe(true);
    expect(await usersData.claimLoginAttempt(bob.id)).toBe(false);
    // Expire the lock: the next attempt counts as the first of a new window, not the ninth.
    await db.update(schema.users).set({ lockedUntil: new Date(Date.now() - 1000) }).where(eq(schema.users.id, bob.id));
    expect(await usersData.claimLoginAttempt(bob.id)).toBe(true);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, bob.id));
    expect(row).toMatchObject({ failedLogins: 1, lockedUntil: null });
  });

  it("parallel guesses can't exceed the limit", async () => {
    await usersData.clearFailedLogins(alice.id);
    const results = await Promise.all(Array.from({ length: 20 }, () => usersData.claimLoginAttempt(alice.id)));
    expect(results.filter(Boolean)).toHaveLength(8);
  });

  it("search escapes LIKE wildcards", async () => {
    await jobsData.createJob(alice.id, { ...base, company: "100% Remote Co" });
    expect((await jobsData.listJobs(alice.id, { query: "100%" })).map((j) => j.company)).toEqual(["100% Remote Co"]);
    expect(await jobsData.listJobs(alice.id, { query: "_" })).toHaveLength(0);
  });
});
