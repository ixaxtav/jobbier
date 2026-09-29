import { z } from "zod";
import { eventKindEnum, outcomeEnum, payPeriodEnum, stageEnum, workModeEnum, documentKindEnum } from "@/db/schema";

/** Result shape every Server Action returns, so forms can render errors consistently. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok(): { ok: true; data: undefined };
export function ok<T>(data: T): { ok: true; data: T };
export function ok<T>(data?: T) {
  return { ok: true as const, data };
}

export const fail = (error: string, fieldErrors?: Record<string, string>) => ({ ok: false as const, error, fieldErrors });

const uuid = z.uuid();
/** Server Actions are public endpoints: every id argument is checked before it reaches a query. */
export const isId = (value: unknown): value is string => uuid.safeParse(value).success;
export const badId = () => fail("That item no longer exists. Refresh the page.");

/** Turn a zod error into one message per field (first issue wins). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

export function invalid(error: z.ZodError) {
  return fail("Check the highlighted fields.", fieldErrors(error));
}

/** FormData → plain object; repeated keys become arrays. */
export function formToObject(form: FormData) {
  const out: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  return out;
}

// ─── Field helpers ─────────────────────────────────────────────────────────

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const optionalText = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? blankToNull(v.trim()) : v ?? null),
    z.string().max(max, `${label} is too long`).nullable(),
  );

const requiredText = (max: number, label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`);

const optionalUrl = z.preprocess(
  (v) => {
    const s = typeof v === "string" ? v.trim() : v;
    if (!s) return null;
    return typeof s === "string" && !/^[a-z][a-z\d+.-]*:\/\//i.test(s) ? `https://${s}` : s;
  },
  z
    .url({ protocol: /^https?$/, error: "Enter a full link, like https://…" })
    .max(2000)
    .nullable(),
);

/** Accepts "120000", "120,000", "$120k", "1.5m". */
export function parseMoney(input: unknown): number | null | typeof NaN {
  if (typeof input === "number") return input;
  if (typeof input !== "string") return null;
  const s = input.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!s) return null;
  const match = /^(\d+(?:\.\d+)?)([km])?$/.exec(s);
  if (!match) return NaN;
  const n = Number(match[1]) * (match[2] === "k" ? 1_000 : match[2] === "m" ? 1_000_000 : 1);
  return Math.round(n);
}

const money = z.preprocess(
  parseMoney,
  z.number({ error: "Use a number, like 120k" }).int().min(0).max(100_000_000, "That’s a lot — check the number").nullable(),
);

const optionalEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(blankToNull, z.enum(values).nullable());

const optionalDate = z.preprocess(
  blankToNull,
  z.iso.date({ error: "Pick a date" }).nullable(),
);

// ─── Schemas ───────────────────────────────────────────────────────────────

export const jobInput = z
  .object({
    company: requiredText(120, "Company"),
    title: requiredText(160, "Role"),
    url: optionalUrl,
    location: optionalText(160, "Location"),
    workMode: optionalEnum(workModeEnum.enumValues),
    payMin: money,
    payMax: money,
    payPeriod: z.enum(payPeriodEnum.enumValues).default("year"),
    currency: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : "USD"), z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code")),
    description: optionalText(20_000, "Description"),
    source: optionalText(120, "Source"),
    excitement: z.preprocess(
      (v) => (v === "" || v == null || v === "0" ? null : Number(v)),
      z.number().int().min(1).max(5).nullable(),
    ),
  })
  .refine((j) => j.payMin == null || j.payMax == null || j.payMin <= j.payMax, {
    path: ["payMax"],
    message: "Max should be at least the min",
  });
export type JobInput = z.infer<typeof jobInput>;

export const newJobInput = jobInput.and(
  z.object({ stage: z.enum(stageEnum.enumValues).exclude(["closed"]).default("saved") }),
);

export const stageMoveInput = z.object({
  jobId: z.uuid(),
  stage: z.enum(stageEnum.enumValues),
  outcome: optionalEnum(outcomeEnum.enumValues),
});

export const nextActionInput = z.object({
  jobId: z.uuid(),
  nextAction: optionalText(200, "Next step"),
  nextActionDue: optionalDate,
});

export const noteInput = z.object({
  jobId: z.uuid(),
  body: requiredText(5000, "Note"),
});

export const eventInput = z.object({
  jobId: z.uuid(),
  kind: z.enum(eventKindEnum.enumValues),
  title: requiredText(160, "Title"),
  startsAt: z.string({ error: "Pick a date and time" }).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time"),
  durationMinutes: z.coerce.number().int().min(5).max(24 * 60).default(45),
  location: optionalText(500, "Where"),
  notes: optionalText(5000, "Notes"),
});

export const contactInput = z.object({
  jobId: z.uuid(),
  name: requiredText(120, "Name"),
  role: optionalText(120, "Role"),
  email: z.preprocess(blankToNull, z.email("Enter a valid email").max(200).nullable()),
  url: optionalUrl,
  notes: optionalText(2000, "Notes"),
});

export const documentKindInput = z.enum(documentKindEnum.enumValues);

export const leadInput = z.object({
  jobId: z.uuid(),
  toUserIds: z.preprocess(
    (v) => (Array.isArray(v) ? v : v ? [v] : []),
    z.array(z.uuid()).min(1, "Pick at least one friend").max(20),
  ),
  note: optionalText(500, "Message"),
});

const password = z.string().min(10, "Use at least 10 characters").max(200, "That’s too long");

export const signUpInput = z.object({
  name: requiredText(80, "Name"),
  email: z.email("Enter a valid email").max(200).transform((e) => e.toLowerCase()),
  password,
  inviteCode: z.string().trim().min(1, "Enter the invite code"),
  timeZone: z.string().max(64).optional(),
});

export const signInInput = z.object({
  email: z.string().trim().toLowerCase().min(1, "Enter your email"),
  password: z.string().min(1, "Enter your password"),
});

export const profileInput = z.object({
  name: requiredText(80, "Name"),
  timeZone: z.string().min(1).max(64),
});

export const preferencesInput = z.object({
  payFloor: money,
  payFloorPeriod: z.enum(payPeriodEnum.enumValues).default("year"),
  workModes: z.preprocess((v) => (Array.isArray(v) ? v : v ? [v] : []), z.array(z.enum(workModeEnum.enumValues))),
  staleAfterDays: z.coerce.number().int().min(3, "At least 3 days").max(60, "At most 60 days"),
});

export const passwordChangeInput = z
  .object({ current: z.string().min(1, "Enter your current password"), next: password, confirm: z.string() })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords don’t match" });
