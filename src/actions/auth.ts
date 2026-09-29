"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { clearFailedLogins, createUser, findUserByEmail, recordFailedLogin } from "@/data/users";
import { getDummyHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { endSession, startSession } from "@/lib/auth/session";
import { isValidTimeZone } from "@/lib/dates";
import { fail, formToObject, invalid, signInInput, signUpInput, type ActionResult } from "@/lib/validation";

/** Only allow redirects back into the app, never to another site. */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/today";
}

function inviteCodeMatches(input: string) {
  const expected = process.env.INVITE_CODE;
  if (!expected) return false;
  const a = Buffer.from(input.trim().toLowerCase());
  const b = Buffer.from(expected.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function signUp(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = signUpInput.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { name, email, password, inviteCode, timeZone } = parsed.data;

  if (!process.env.INVITE_CODE) return fail("Sign-ups are closed right now.");
  if (!inviteCodeMatches(inviteCode)) return fail("That invite code isn't right.", { inviteCode: "Ask the friend who invited you for the code" });
  if (await findUserByEmail(email)) return fail("There's already an account with that email.", { email: "Already registered — try signing in" });

  const user = await createUser({
    name,
    email,
    passwordHash: await hashPassword(password),
    timeZone: timeZone && isValidTimeZone(timeZone) ? timeZone : "America/New_York",
  });
  await startSession(user.id);
  redirect("/today?welcome=1");
}

export async function signIn(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = signInInput.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { email, password } = parsed.data;

  const user = await findUserByEmail(email);
  const wrong = fail("That email and password don't match.");

  if (!user) {
    // Same amount of work as a real check, so response time doesn't reveal who has an account.
    await verifyPassword(password, await getDummyHash());
    return wrong;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return fail("Too many attempts. Wait 15 minutes and try again.");
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    await recordFailedLogin(user.id);
    return wrong;
  }

  await clearFailedLogins(user.id);
  await startSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function signOut() {
  await endSession();
  redirect("/sign-in");
}
