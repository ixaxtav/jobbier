"use client";

import { useFormAction } from "@/lib/client/use-form-action";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { signIn, signUp } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useFormAction(signIn);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form onSubmit={action} className="flex flex-col gap-4" noValidate>
      <div className="mb-2">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-ink-2">Sign in to pick up where you left off.</p>
      </div>
      {notice ? <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-2">{notice}</p> : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" error={errors.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required autoFocus />}
      </Field>
      <Field label="Password" error={errors.password}>
        {(p) => <PasswordInput {...p} name="password" autoComplete="current-password" />}
      </Field>
      <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
      <Button type="submit" variant="ink" size="lg" pending={pending} className="mt-1">
        Sign in
      </Button>
      <p className="mt-4 text-sm text-ink-2">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          Create an account
        </Link>{" "}
        with an invite code from a friend.
      </p>
      <p className="text-xs text-ink-3">Forgot your password? Ask the person who runs your Jobbier to reset it.</p>
    </form>
  );
}

export function SignUpForm() {
  // The browser knows the user's time zone; add it at submit time.
  const [state, action, pending] = useFormAction((prev: Awaited<ReturnType<typeof signUp>> | null, form: FormData) => {
    form.set("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    return signUp(prev, form);
  });
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form onSubmit={action} className="flex flex-col gap-4" noValidate>
      <div className="mb-2">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-ink-2">Jobbier is invite-only and free. Your jobs are private to you.</p>
      </div>
      <Field label="Your name" error={errors.name}>
        {(p) => <Input {...p} name="name" autoComplete="name" required autoFocus />}
      </Field>
      <Field label="Email" error={errors.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}
      </Field>
      <Field label="Password" hint="At least 10 characters." error={errors.password}>
        {(p) => <PasswordInput {...p} name="password" autoComplete="new-password" />}
      </Field>
      <Field label="Invite code" error={errors.inviteCode}>
        {(p) => <Input {...p} name="inviteCode" autoComplete="off" autoCapitalize="none" spellCheck={false} required />}
      </Field>
      <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
      <Button type="submit" variant="ink" size="lg" pending={pending} className="mt-1">
        Create account
      </Button>
      <p className="mt-4 text-sm text-ink-2">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-11" required />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-ink-3 hover:text-ink"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
