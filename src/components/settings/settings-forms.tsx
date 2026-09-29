"use client";

import { useFormAction } from "@/lib/client/use-form-action";
import { Check, Copy, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  changePasswordAction,
  deleteAccountAction,
  updatePreferencesAction,
  updateProfileAction,
} from "@/actions/settings";
import type { PayPeriod, WorkMode } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { WORK_MODE_LABEL } from "@/lib/format";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import type { ActionResult } from "@/lib/validation";

function useSavedToast(state: ActionResult | null, message: string, after?: () => void) {
  useEffect(() => {
    if (state?.ok) {
      toast(message);
      after?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

const errorsOf = (state: ActionResult | null) => (state && !state.ok ? state.fieldErrors ?? {} : {});
const formError = (state: ActionResult | null) => (state && !state.ok && !state.fieldErrors ? state.error : null);

export function ProfileForm({ name, timeZone }: { name: string; timeZone: string }) {
  const [state, action, pending] = useFormAction(updateProfileAction);
  useSavedToast(state, "Profile saved");
  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [timeZone];
    return all.includes(timeZone) ? all : [timeZone, ...all];
  }, [timeZone]);
  const errors = errorsOf(state);
  return (
    <form onSubmit={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" error={errors.name}>
        {(p) => <Input {...p} name="name" defaultValue={name} autoComplete="name" required />}
      </Field>
      <Field label="Time zone" hint="Used for due dates and interview times." error={errors.timeZone}>
        {(p) => (
          <Select {...p} name="timeZone" defaultValue={timeZone}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <FormError message={formError(state)} />
      <div className="sm:col-span-2">
        <Button type="submit" variant="ink" pending={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

export function PreferencesForm({
  payFloor,
  payFloorPeriod,
  workModes,
  staleAfterDays,
}: {
  payFloor: number | null;
  payFloorPeriod: PayPeriod;
  workModes: WorkMode[];
  staleAfterDays: number;
}) {
  const [state, action, pending] = useFormAction(updatePreferencesAction);
  useSavedToast(state, "Preferences saved");
  const errors = errorsOf(state);
  return (
    <form onSubmit={action} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Pay floor</legend>
        <div className="flex max-w-md gap-2">
          <Input name="payFloor" aria-label="Pay floor" defaultValue={payFloor ?? ""} placeholder="e.g. 110k" inputMode="decimal" aria-invalid={errors.payFloor ? true : undefined} />
          <Select name="payFloorPeriod" aria-label="Per" defaultValue={payFloorPeriod} className="w-36">
            <option value="year">per year</option>
            <option value="hour">per hour</option>
          </Select>
        </div>
        <p className={cn("text-xs", errors.payFloor ? "font-medium text-danger" : "text-ink-3")}>
          {errors.payFloor ?? "The least you'd take. Jobs that pay less get a quiet warning — nothing is hidden."}
        </p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Work setups you want</legend>
        <div className="flex flex-wrap gap-2">
          {(["remote", "hybrid", "onsite"] as const).map((m) => (
            <label key={m} className="relative">
              <input type="checkbox" name="workModes" value={m} defaultChecked={workModes.includes(m)} className="peer sr-only" />
              <span className="flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink-2 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                {WORK_MODE_LABEL[m]}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-3">Leave all off if you&rsquo;re open to anything.</p>
      </fieldset>

      <Field label="Nudge me about quiet applications after" error={errors.staleAfterDays} className="max-w-xs">
        {(p) => (
          <div className="flex items-center gap-2">
            <Input {...p} name="staleAfterDays" type="number" min={3} max={60} defaultValue={staleAfterDays} className="w-24" />
            <span className="text-sm text-ink-2">days</span>
          </div>
        )}
      </Field>

      <FormError message={formError(state)} />
      <div>
        <Button type="submit" variant="ink" pending={pending}>
          Save preferences
        </Button>
      </div>
    </form>
  );
}

export function InviteCard({ code, url }: { code: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Join me on Jobbier: ${url}\nInvite code: ${code}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy — select the text instead.");
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-2 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-3">Sign-up link</p>
          <p className="truncate font-medium select-all">{url}</p>
          <p className="mt-2 text-xs text-ink-3">Invite code</p>
          <p className="text-xl font-bold tracking-wide select-all" style={{ fontVariationSettings: '"wdth" 85' }}>
            {code}
          </p>
        </div>
        <Button onClick={copy} icon={copied ? <Check /> : <Copy />}>
          {copied ? "Copied" : "Copy invite"}
        </Button>
      </div>
      <p className="text-xs text-ink-3">Anyone with the code can make an account. Everyone&rsquo;s jobs stay private; friends can only send each other leads.</p>
    </div>
  );
}

/** Remember the choice for server renders and apply it now, without a reload. */
function applyTheme(next: Theme) {
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  const root = document.documentElement;
  if (next === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", next);
}

export function ThemePicker({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  function pick(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }
  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "system", label: "Match my device", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className="grid gap-2 sm:grid-cols-3">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => pick(value)}
          className={cn(
            "flex h-11 items-center gap-2.5 rounded-md border px-3.5 text-sm font-medium",
            theme === value ? "border-ink bg-surface-2 text-ink" : "border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink",
          )}
        >
          <Icon aria-hidden className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useFormAction(changePasswordAction);
  const [key, setKey] = useState(0);
  useSavedToast(state, "Password changed. Other devices were signed out.", () => setKey((k) => k + 1));
  const errors = errorsOf(state);
  return (
    <form key={key} onSubmit={action} className="grid max-w-md gap-4">
      <input type="text" name="username" autoComplete="username" className="hidden" readOnly aria-hidden tabIndex={-1} />
      <Field label="Current password" error={errors.current}>
        {(p) => <Input {...p} name="current" type="password" autoComplete="current-password" required />}
      </Field>
      <Field label="New password" hint="At least 10 characters." error={errors.next}>
        {(p) => <Input {...p} name="next" type="password" autoComplete="new-password" required />}
      </Field>
      <Field label="Repeat new password" error={errors.confirm}>
        {(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" required />}
      </Field>
      <FormError message={formError(state)} />
      <div>
        <Button type="submit" variant="ink" pending={pending}>
          Change password
        </Button>
      </div>
    </form>
  );
}

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, action, pending] = useFormAction(deleteAccountAction);
  const [value, setValue] = useState("");
  const errors = errorsOf(state);
  return (
    <form onSubmit={action} className="flex max-w-md flex-col gap-3">
      <p className="text-sm text-ink-2">
        Deletes your account, every job, note, event, contact and file. Leads you sent to friends stay with them. Export first if you want a copy.
      </p>
      <Field label={`Type ${email} to confirm`} error={errors.confirm}>
        {(p) => <Input {...p} name="confirm" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" spellCheck={false} />}
      </Field>
      <FormError message={formError(state)} />
      <div>
        <Button type="submit" variant="danger" pending={pending} disabled={value.trim().toLowerCase() !== email.toLowerCase()}>
          Delete my account
        </Button>
      </div>
    </form>
  );
}
