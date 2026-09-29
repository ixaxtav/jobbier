import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { documents, users, type PayPeriod, type WorkMode } from "@/db/schema";
import { removeFile } from "@/lib/storage";

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return user ?? null;
}

export async function createUser(values: { name: string; email: string; passwordHash: string; timeZone: string }) {
  const [user] = await db.insert(users).values(values).returning();
  return user;
}

const LOCK_AFTER = 8;
const LOCK_MINUTES = 15;

/** Records a failed sign-in; locks the account for a while after repeated failures. */
export async function recordFailedLogin(userId: string) {
  await db
    .update(users)
    .set({
      failedLogins: sql`${users.failedLogins} + 1`,
      lockedUntil: sql`case when ${users.failedLogins} + 1 >= ${LOCK_AFTER} then now() + interval '${sql.raw(String(LOCK_MINUTES))} minutes' else ${users.lockedUntil} end`,
    })
    .where(eq(users.id, userId));
}

export async function clearFailedLogins(userId: string) {
  await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, userId));
}

export async function updateProfile(userId: string, values: { name: string; timeZone: string }) {
  await db.update(users).set(values).where(eq(users.id, userId));
}

export async function updatePreferences(
  userId: string,
  values: { payFloor: number | null; payFloorPeriod: PayPeriod; workModes: WorkMode[]; staleAfterDays: number },
) {
  await db.update(users).set(values).where(eq(users.id, userId));
}

export async function updatePasswordHash(userId: string, passwordHash: string) {
  await db.update(users).set({ passwordHash, failedLogins: 0, lockedUntil: null }).where(eq(users.id, userId));
}

export async function dismissGettingStarted(userId: string) {
  await db.update(users).set({ gettingStartedDismissedAt: new Date() }).where(eq(users.id, userId));
}

/** Deletes the account and everything in it (jobs, files, sessions cascade; stored files are removed). */
export async function deleteAccount(userId: string) {
  const files = await db.select({ key: documents.storageKey }).from(documents).where(eq(documents.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  await Promise.all(files.map((f) => removeFile(f.key)));
}
