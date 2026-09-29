"use server";

import { revalidatePath } from "next/cache";
import { NotFoundError } from "@/data/jobs";
import { dismissLead, restoreLead, saveLead, sendLeads, unsendLead } from "@/data/leads";
import { requireUser } from "@/lib/auth/session";
import { pluralize } from "@/lib/format";
import { fail, formToObject, invalid, leadInput, ok, isId, badId, type ActionResult } from "@/lib/validation";

function refresh() {
  revalidatePath("/", "layout");
}

export async function sendLeadAction(_: unknown, form: FormData): Promise<ActionResult<{ message: string }>> {
  const user = await requireUser();
  const parsed = leadInput.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const sent = await sendLeads(user.id, parsed.data.jobId, parsed.data.toUserIds, parsed.data.note);
    if (sent === 0) return fail("Those friends aren’t in Jobbier anymore.");
    refresh();
    return ok({ message: `Sent to ${pluralize(sent, "friend")}` });
  } catch (error) {
    if (error instanceof NotFoundError) return fail("That job no longer exists.");
    throw error;
  }
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    refresh();
    return ok(data);
  } catch (error) {
    if (error instanceof NotFoundError) return fail("That lead no longer exists.");
    throw error;
  }
}

export async function saveLeadAction(leadId: string) {
  const user = await requireUser();
  if (!isId(leadId)) return badId();
  return run(() => saveLead(user.id, leadId));
}

export async function dismissLeadAction(leadId: string) {
  const user = await requireUser();
  if (!isId(leadId)) return badId();
  return run(() => dismissLead(user.id, leadId));
}

export async function restoreLeadAction(leadId: string) {
  const user = await requireUser();
  if (!isId(leadId)) return badId();
  return run(() => restoreLead(user.id, leadId));
}

export async function unsendLeadAction(leadId: string) {
  const user = await requireUser();
  if (!isId(leadId)) return badId();
  return run(() => unsendLead(user.id, leadId));
}
