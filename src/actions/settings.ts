"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteAccount,
  dismissGettingStarted,
  updatePasswordHash,
  updatePreferences,
  updateProfile,
} from "@/data/users";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { endOtherSessions, endSession, requireUser } from "@/lib/auth/session";
import { isValidTimeZone } from "@/lib/dates";
import {
  fail,
  formToObject,
  invalid,
  ok,
  passwordChangeInput,
  preferencesInput,
  profileInput,
  type ActionResult,
} from "@/lib/validation";

function refresh() {
  revalidatePath("/", "layout");
}

export async function updateProfileAction(_: unknown, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = profileInput.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  if (!isValidTimeZone(parsed.data.timeZone)) return fail("Check the highlighted fields.", { timeZone: "Pick a time zone from the list" });
  await updateProfile(user.id, parsed.data);
  refresh();
  return ok();
}

export async function updatePreferencesAction(_: unknown, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = preferencesInput.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  await updatePreferences(user.id, parsed.data);
  refresh();
  return ok();
}

export async function changePasswordAction(_: unknown, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = passwordChangeInput.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) {
    return fail("Check the highlighted fields.", { current: "That's not your current password" });
  }
  await updatePasswordHash(user.id, await hashPassword(parsed.data.next));
  await endOtherSessions(user.id);
  return ok();
}

export async function dismissGettingStartedAction() {
  const user = await requireUser();
  await dismissGettingStarted(user.id);
  refresh();
}

export async function deleteAccountAction(_: unknown, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const confirm = String(form.get("confirm") ?? "").trim().toLowerCase();
  if (confirm !== user.email.toLowerCase()) {
    return fail("Type your email exactly to confirm.", { confirm: "Doesn't match your email" });
  }
  await endSession();
  await deleteAccount(user.id);
  redirect("/sign-in?deleted=1");
}
