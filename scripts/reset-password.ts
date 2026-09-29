/**
 * Jobbier sends no email, so a forgotten password is reset by whoever runs it:
 *   DATABASE_URL=… npm run user:reset-password -- friend@example.com
 * Prints a one-time password to hand over; the friend changes it in Settings.
 */
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sessions, users } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";

const email = process.argv[2];
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!email || !url) {
  console.error("usage: DATABASE_URL=… npm run user:reset-password -- friend@example.com");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client, { casing: "snake_case" });

try {
  const [user] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`);
  if (!user) {
    console.error(`No account for ${email}`);
    process.exitCode = 1;
  } else {
    const temporary = randomBytes(9).toString("base64url");
    await db.update(users).set({ passwordHash: await hashPassword(temporary), failedLogins: 0, lockedUntil: null }).where(eq(users.id, user.id));
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    console.log(`Temporary password for ${email}: ${temporary}`);
  }
} finally {
  await client.end();
}
