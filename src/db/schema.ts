import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const stageEnum = pgEnum("stage", ["saved", "applied", "interviewing", "offer", "closed"]);
export const outcomeEnum = pgEnum("outcome", ["hired", "rejected", "declined", "withdrew", "ghosted"]);
export const workModeEnum = pgEnum("work_mode", ["remote", "hybrid", "onsite"]);
export const payPeriodEnum = pgEnum("pay_period", ["year", "hour"]);
export const eventKindEnum = pgEnum("event_kind", ["interview", "call", "assessment", "deadline", "other"]);
export const activityKindEnum = pgEnum("activity_kind", ["created", "stage", "note", "event", "lead"]);
export const documentKindEnum = pgEnum("document_kind", ["resume", "cover_letter", "portfolio", "other"]);
export const leadStatusEnum = pgEnum("lead_status", ["pending", "saved", "dismissed"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    timeZone: text("time_zone").notNull().default("America/New_York"),
    payFloor: integer("pay_floor"),
    payFloorPeriod: payPeriodEnum("pay_floor_period").notNull().default("year"),
    workModes: workModeEnum("work_modes").array().notNull().default(sql`'{}'`),
    staleAfterDays: smallint("stale_after_days").notNull().default(14),
    failedLogins: smallint("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    gettingStartedDismissedAt: timestamp("getting_started_dismissed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    // sha256 of the cookie token — the raw token never touches the database.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    location: text("location"),
    workMode: workModeEnum("work_mode"),
    payMin: integer("pay_min"),
    payMax: integer("pay_max"),
    payPeriod: payPeriodEnum("pay_period").notNull().default("year"),
    currency: text("currency").notNull().default("USD"),
    stage: stageEnum("stage").notNull().default("saved"),
    // The furthest stop on the line this job ever reached, so a later rejection
    // doesn't erase the fact that it got to interviews (keeps stats honest).
    furthestStage: stageEnum("furthest_stage").notNull().default("saved"),
    outcome: outcomeEnum("outcome"),
    excitement: smallint("excitement"),
    description: text("description"),
    source: text("source"),
    nextAction: text("next_action"),
    nextActionDue: date("next_action_due"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("jobs_user_stage_idx").on(t.userId, t.stage)],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    kind: eventKindEnum("kind").notNull().default("interview"),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMinutes: smallint("duration_minutes").notNull().default(45),
    location: text("location"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("events_user_starts_idx").on(t.userId, t.startsAt), index("events_job_idx").on(t.jobId)],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    kind: activityKindEnum("kind").notNull(),
    body: text("body"),
    meta: jsonb("meta").$type<Record<string, string | null>>(),
    ...timestamps,
  },
  (t) => [index("activities_job_idx").on(t.jobId, t.createdAt), index("activities_user_idx").on(t.userId, t.createdAt)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role"),
    email: text("email"),
    url: text("url"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("contacts_job_idx").on(t.jobId)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: documentKindEnum("kind").notNull().default("resume"),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    ...timestamps,
  },
  (t) => [index("documents_user_idx").on(t.userId)],
);

export const jobDocuments = pgTable(
  "job_documents",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.jobId, t.documentId] })],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromUserId: uuid("from_user_id").references(() => users.id, { onDelete: "set null" }),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // A snapshot, so the sender can delete their own job without breaking the lead.
    company: text("company").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    location: text("location"),
    workMode: workModeEnum("work_mode"),
    payMin: integer("pay_min"),
    payMax: integer("pay_max"),
    payPeriod: payPeriodEnum("pay_period").notNull().default("year"),
    description: text("description"),
    note: text("note"),
    status: leadStatusEnum("status").notNull().default("pending"),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("leads_to_status_idx").on(t.toUserId, t.status), index("leads_from_idx").on(t.fromUserId)],
);

export type User = typeof users.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type JobEvent = typeof events.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Lead = typeof leads.$inferSelect;

export type Stage = (typeof stageEnum.enumValues)[number];
export type Outcome = (typeof outcomeEnum.enumValues)[number];
export type WorkMode = (typeof workModeEnum.enumValues)[number];
export type PayPeriod = (typeof payPeriodEnum.enumValues)[number];
export type EventKind = (typeof eventKindEnum.enumValues)[number];
export type DocumentKind = (typeof documentKindEnum.enumValues)[number];
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
