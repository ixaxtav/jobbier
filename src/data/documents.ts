import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { documents, jobDocuments, jobs, type DocumentKind } from "@/db/schema";
import { removeFile } from "@/lib/storage";
import { NotFoundError, touchJob } from "./jobs";

export async function listDocuments(userId: string) {
  return db
    .select({
      document: documents,
      jobCount: sql<number>`(select count(*)::int from ${jobDocuments} where ${jobDocuments.documentId} = ${documents.id})`,
    })
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt));
}

export async function getDocument(userId: string, documentId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);
  return doc ?? null;
}

export async function createDocument(
  userId: string,
  values: { name: string; kind: DocumentKind; storageKey: string; contentType: string; size: number },
) {
  const [doc] = await db.insert(documents).values({ ...values, userId }).returning();
  return doc;
}

export async function renameDocument(userId: string, documentId: string, name: string, kind: DocumentKind) {
  const [doc] = await db
    .update(documents)
    .set({ name, kind })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .returning();
  if (!doc) throw new NotFoundError("File not found");
}

export async function deleteDocument(userId: string, documentId: string) {
  const doc = await getDocument(userId, documentId);
  if (!doc) return;
  await db.delete(documents).where(eq(documents.id, doc.id));
  await removeFile(doc.storageKey);
}

export async function attachDocument(userId: string, jobId: string, documentId: string) {
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))).limit(1);
  const doc = await getDocument(userId, documentId);
  if (!job || !doc) throw new NotFoundError("Not found");
  await db.insert(jobDocuments).values({ jobId, documentId }).onConflictDoNothing();
  await touchJob(userId, jobId);
}

export async function detachDocument(userId: string, jobId: string, documentId: string) {
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))).limit(1);
  if (!job) throw new NotFoundError("Job not found");
  await db.delete(jobDocuments).where(and(eq(jobDocuments.jobId, jobId), eq(jobDocuments.documentId, documentId)));
}
