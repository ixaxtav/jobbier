"use client";

import { useState } from "react";
import type { Job, Stage } from "@/db/schema";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { STAGE_BG } from "@/components/stage";
import { cn } from "@/lib/cn";
import { STAGE_META } from "@/lib/domain/stages";
import { WORK_MODE_LABEL } from "@/lib/format";

export type JobDefaults = Partial<
  Pick<Job, "company" | "title" | "url" | "location" | "workMode" | "payMin" | "payMax" | "payPeriod" | "currency" | "description" | "source" | "excitement">
>;

const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "MXN", "AUD"];

export const INTEREST_LABELS = ["", "Not sure", "Maybe", "Interested", "Very interested", "Dream job"];

/** Shared fields for adding and editing a job. Uncontrolled — the Server Action reads the form. */
export function JobFields({
  defaults = {},
  errors = {},
  showStage = false,
}: {
  defaults?: JobDefaults;
  errors?: Record<string, string>;
  showStage?: boolean;
}) {
  const [showDescription, setShowDescription] = useState(Boolean(defaults.description));
  const currencies = defaults.currency && !CURRENCIES.includes(defaults.currency) ? [defaults.currency, ...CURRENCIES] : CURRENCIES;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Role" error={errors.title}>
        {(p) => <Input {...p} name="title" defaultValue={defaults.title ?? ""} placeholder="Product designer" required autoComplete="off" />}
      </Field>
      <Field label="Company" error={errors.company}>
        {(p) => <Input {...p} name="company" defaultValue={defaults.company ?? ""} placeholder="Acme" required autoComplete="organization" />}
      </Field>

      <Field label="Location" error={errors.location}>
        {(p) => <Input {...p} name="location" defaultValue={defaults.location ?? ""} placeholder="Miami, FL" autoComplete="off" />}
      </Field>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Work setup</legend>
        <Segmented
          name="workMode"
          defaultValue={defaults.workMode ?? ""}
          options={[
            { value: "", label: "Any" },
            ...(["remote", "hybrid", "onsite"] as const).map((m) => ({ value: m, label: WORK_MODE_LABEL[m] })),
          ]}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium">Pay</legend>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:grid-cols-[1fr_auto_1fr_auto_auto]">
          <Input name="payMin" aria-label="Minimum pay" defaultValue={defaults.payMin ?? ""} placeholder="Min, e.g. 120k" inputMode="decimal" aria-invalid={errors.payMin ? true : undefined} />
          <span className="text-ink-3" aria-hidden>
            –
          </span>
          <Input name="payMax" aria-label="Maximum pay" defaultValue={defaults.payMax ?? ""} placeholder="Max" inputMode="decimal" aria-invalid={errors.payMax ? true : undefined} />
          <div className="col-span-3 grid grid-cols-2 gap-2 sm:col-span-2 sm:flex">
            <Select name="payPeriod" aria-label="Pay period" defaultValue={defaults.payPeriod ?? "year"}>
              <option value="year">per year</option>
              <option value="hour">per hour</option>
            </Select>
            <Select name="currency" aria-label="Currency" defaultValue={defaults.currency ?? "USD"}>
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
        </div>
        {errors.payMin || errors.payMax ? <p className="text-xs font-medium text-danger">{errors.payMin ?? errors.payMax}</p> : null}
      </fieldset>

      {showStage ? (
        <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">Where is it at?</legend>
          <Segmented
            name="stage"
            defaultValue="saved"
            className="grid grid-cols-2 sm:flex"
            options={(["saved", "applied", "interviewing", "offer"] as Stage[]).map((s) => ({
              value: s,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={cn("size-2 rounded-full", STAGE_BG[s])} />
                  {STAGE_META[s].label}
                </span>
              ),
            }))}
          />
        </fieldset>
      ) : null}

      <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium">How interested are you?</legend>
        <InterestPicker defaultValue={defaults.excitement ?? null} />
      </fieldset>

      <Field label="Link to the posting" error={errors.url} className="sm:col-span-2">
        {(p) => <Input {...p} name="url" type="url" defaultValue={defaults.url ?? ""} placeholder="https://" inputMode="url" autoComplete="url" />}
      </Field>
      <Field label="Where you found it" hint="LinkedIn, a friend, the company site…" error={errors.source} className="sm:col-span-2">
        {(p) => <Input {...p} name="source" defaultValue={defaults.source ?? ""} autoComplete="off" />}
      </Field>

      <div className="sm:col-span-2">
        {showDescription ? (
          <Field label="Job description" hint="Paste the posting — it's handy when prepping for interviews." error={errors.description}>
            {(p) => <Textarea {...p} name="description" defaultValue={defaults.description ?? ""} rows={6} />}
          </Field>
        ) : (
          <button type="button" onClick={() => setShowDescription(true)} className="text-sm font-medium text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
            Add the job description
          </button>
        )}
      </div>
    </div>
  );
}

/** Radio group styled as a segmented control. Works without JavaScript. */
export function Segmented({
  name,
  options,
  defaultValue,
  className,
}: {
  name: string;
  options: { value: string; label: React.ReactNode }[];
  defaultValue: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1 rounded-md bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <label key={o.value} className="relative flex-1">
          <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} className="peer sr-only" />
          <span className="flex h-8 items-center justify-center rounded-sm px-2.5 text-sm whitespace-nowrap text-ink-2 transition-colors peer-checked:bg-surface peer-checked:font-medium peer-checked:text-ink peer-checked:shadow-[0_1px_2px_rgb(0_0_0/0.12)] peer-focus-visible:outline-2 peer-focus-visible:outline-ink hover:text-ink">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

export function InterestPicker({ defaultValue }: { defaultValue: number | null }) {
  const [value, setValue] = useState<number>(defaultValue ?? 0);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Interest" className="flex gap-1" onMouseLeave={() => setHover(null)}>
        <input type="hidden" name="excitement" value={value || ""} />
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={INTEREST_LABELS[n]}
            onClick={() => setValue(value === n ? 0 : n)}
            onMouseEnter={() => setHover(n)}
            className={cn(
              "h-7 w-7 rounded-sm border transition-colors",
              n <= shown ? "border-transparent bg-ink" : "border-line-strong bg-surface hover:border-ink-3",
            )}
          >
            <span aria-hidden className={cn("block text-xs font-semibold", n <= shown ? "text-bg" : "text-ink-3")}>
              {n}
            </span>
          </button>
        ))}
      </div>
      <span className="text-sm text-ink-2" aria-live="polite">
        {INTEREST_LABELS[shown] || "Not rated"}
      </span>
    </div>
  );
}
