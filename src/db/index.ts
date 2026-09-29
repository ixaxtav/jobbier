import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function connectionString() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and point it at a Postgres database.");
  }
  return url;
}

// Reuse one client across hot reloads in dev and across invocations on a warm function.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

const client =
  globalForDb.sql ??
  postgres(connectionString(), {
    max: 5,
    // Neon's pooled endpoint runs PgBouncer in transaction mode, which can't use prepared statements.
    prepare: false,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Db = typeof db;
