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

/**
 * Counts a sign-in attempt and returns false if the account is locked. One
 * UPDATE does the check and the increment, so concurrent guesses can't race
 * past the limit. The counter starts over once a lock expires, so a lockout
 * doesn't turn every later typo into another 15-minute lock.
 */
export async function claimLoginAttempt(userId: string): Promise<boolean> {
  const rows = await db.execute<{ id: string }>(sql`
    update users set
      failed_logins = case when locked_until is not null and locked_until <= now() then 1 else failed_logins + 1 end,
      locked_until = case
        when (case when locked_until is not null and locked_until <= now() then 1 else failed_logins + 1 end) >= ${LOCK_AFTER}
          then now() + interval '15 minutes'
        else null
      end
    where id = ${userId} and (locked_until is null or locked_until <= now())
    returning id`);
  return rows.length > 0;
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
