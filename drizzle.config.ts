import { defineConfig } from "drizzle-kit";

// `generate` works offline; only `studio`/`push` need a reachable database.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  casing: "snake_case",
});
