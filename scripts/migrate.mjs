// Applies SQL migrations from ./drizzle. Runs on every deploy (see "vercel-build").
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Preview deploys must never change the production schema.
if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
  console.log(`migrate: skipped on ${process.env.VERCEL_ENV} deploys`);
  process.exit(0);
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("migrate: database is up to date");
} finally {
  await client.end();
}
