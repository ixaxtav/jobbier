"use server";

import { revalidatePath } from "next/cache";
import {
  addContact,
  addEvent,
  addNote,
  deleteContact,
  deleteEvent,
  deleteNote,
  updateContact,
  updateEvent,
} from "@/data/job-details";
import { NotFoundError } from "@/data/jobs";
import { attachDocument, detachDocument } from "@/data/documents";
import { requireUser } from "@/lib/auth/session";
import { zonedLocalToUtc } from "@/lib/dates";
import { contactInput, eventInput, fail, formToObject, invalid, noteInput, ok, type ActionResult } from "@/lib/validation";

function refresh() {
  revalidatePath("/", "layout");
}

async function guard(run: () => Promise<void>): Promise<ActionResult> {
  try {
    await run();
    refresh();
    return ok();
  } catch (error) {
    if (error instanceof NotFoundError) return fail("That no longer exists. Refresh the page.");
    throw error;
  }
}

export async function addNoteAction(_: unknown, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = noteInput.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  return guard(() => addNote(user.id, parsed.data.jobId, parsed.data.body));
}

export async function deleteNoteAction(activityId: string): Promise<ActionResult> {
  const user = await requireUser();
  return guard(() => deleteNote(user.id, activityId));
}

/** Create when there's no eventId, otherwise update. Times arrive as wall-clock in the user's zone. */
export async function saveEventAction(eventId: string | null, _: unknown, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = eventInput.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { jobId, startsAt, ...rest } = parsed.data;
  const when = zonedLocalToUtc(startsAt, user.timeZone);
  if (!when) return fail("Check the highlighted fields.", { startsAt: "Pick a date and time" });
  const values = { ...rest, startsAt: when };
  return guard(async () => {
    if (eventId) await updateEvent(user.id, eventId, values);
    else await addEvent(user.id, jobId, values);
  });
}

export async function deleteEventAction(eventId: string): Promise<ActionResult> {
  const user = await requireUser();
  return guard(() => deleteEvent(user.id, eventId));
}

export async function saveContactAction(contactId: string | null, _: unknown, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = contactInput.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { jobId, ...values } = parsed.data;
  return guard(async () => {
    if (contactId) await updateContact(user.id, contactId, values);
    else await addContact(user.id, jobId, values);
  });
}

export async function deleteContactAction(contactId: string): Promise<ActionResult> {
  const user = await requireUser();
  return guard(() => deleteContact(user.id, contactId));
}

export async function attachDocumentAction(jobId: string, documentId: string): Promise<ActionResult> {
  const user = await requireUser();
  return guard(() => attachDocument(user.id, jobId, documentId));
}

export async function detachDocumentAction(jobId: string, documentId: string): Promise<ActionResult> {
  const user = await requireUser();
  return guard(() => detachDocument(user.id, jobId, documentId));
}
