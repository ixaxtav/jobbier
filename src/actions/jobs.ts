"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createJob,
  deleteJob,
  findDuplicateByUrl,
  moveJob,
  NotFoundError,
  setExcitement,
  setNextAction,
  updateJob,
} from "@/data/jobs";
import { requireUser } from "@/lib/auth/session";
import { fetchPublicPage, ImportError } from "@/lib/import/fetch-page";
import { parseJobPage, type ImportedJob } from "@/lib/import/parse-job";
import {
  fail,
  formToObject,
  invalid,
  jobInput,
  newJobInput,
  nextActionInput,
  ok,
  stageMoveInput,
  isId,
  badId,
  type ActionResult,
} from "@/lib/validation";
import type { Outcome, Stage } from "@/db/schema";

function refresh() {
  revalidatePath("/", "layout");
}

async function guard<T>(run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof NotFoundError) return fail("That job no longer exists. It may have been deleted.");
    throw error;
  }
}

export async function createJobAction(_: unknown, form: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = newJobInput.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const job = await createJob(user.id, parsed.data);
  refresh();
  return ok({ id: job.id });
}

export async function updateJobAction(jobId: string, _: unknown, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(jobId)) return badId();
  const parsed = jobInput.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  return guard(async () => {
    await updateJob(user.id, jobId, parsed.data);
    refresh();
    return ok();
  });
}

export async function moveJobAction(jobId: string, stage: Stage, outcome: Outcome | null = null): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = stageMoveInput.safeParse({ jobId, stage, outcome });
  if (!parsed.success) return fail("That move isn’t possible.");
  return guard(async () => {
    const result = await moveJob(user.id, parsed.data.jobId, parsed.data.stage, parsed.data.outcome);
    if ("error" in result) return fail(result.error);
    refresh();
    return ok();
  });
}

export async function setNextActionAction(_: unknown, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = nextActionInput.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { jobId, nextAction, nextActionDue } = parsed.data;
  if (nextActionDue && !nextAction) return fail("Say what the next step is.", { nextAction: "What will you do?" });
  return guard(async () => {
    await setNextAction(user.id, jobId, nextAction, nextActionDue);
    refresh();
    return ok();
  });
}

export async function clearNextActionAction(jobId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(jobId)) return badId();
  return guard(async () => {
    await setNextAction(user.id, jobId, null, null);
    refresh();
    return ok();
  });
}

export async function setExcitementAction(jobId: string, excitement: number | null): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(jobId)) return badId();
  if (excitement != null && (!Number.isInteger(excitement) || excitement < 1 || excitement > 5)) return fail("Pick 1 to 5.");
  return guard(async () => {
    await setExcitement(user.id, jobId, excitement);
    refresh();
    return ok();
  });
}

export async function deleteJobAction(jobId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(jobId)) return badId();
  await guard(async () => {
    await deleteJob(user.id, jobId);
    return ok();
  });
  refresh();
  redirect("/jobs");
}

export type ImportResult = ImportedJob & { duplicate: { id: string; company: string; title: string } | null };

export async function importJobAction(url: string): Promise<ActionResult<ImportResult>> {
  const user = await requireUser();
  try {
    const page = await fetchPublicPage(url);
    const job = parseJobPage(page.html, page.url);
    const duplicate = (await findDuplicateByUrl(user.id, job.url)) ?? (await findDuplicateByUrl(user.id, url.trim()));
    if (!job.title && !job.company) {
      return fail("Couldn’t find job details on that page. Fill them in by hand — the link is kept.");
    }
    return ok({ ...job, duplicate });
  } catch (error) {
    if (error instanceof ImportError) return fail(error.message);
    console.error("import failed", error);
    return fail("Couldn’t read that page. Fill in the details by hand.");
  }
}
