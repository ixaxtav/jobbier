"use client";

import { useFormAction } from "@/lib/client/use-form-action";
import { ArrowLeft, Link2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { createJobAction, importJobAction, type ImportResult } from "@/actions/jobs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { FormError, Input } from "@/components/ui/field";
import { displayHost } from "@/lib/format";
import { JobFields, type JobDefaults } from "./job-fields";

type AddJobContext = { open: () => void };
const Ctx = createContext<AddJobContext>({ open: () => {} });
export const useAddJob = () => useContext(Ctx);

/** Mounted once in the app shell; any button can open it, and "N" does too. */
export function AddJobProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const value = useMemo(
    () => ({
      open: () => {
        setSession((s) => s + 1);
        setOpen(true);
      },
    }),
    [],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      e.preventDefault();
      value.open();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <AddJobDialog key={session} open={open} onOpenChange={setOpen} />
    </Ctx.Provider>
  );
}

type Step = { kind: "link" } | { kind: "form"; defaults: JobDefaults; imported?: ImportResult; importError?: string };

function AddJobDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState<Step>({ kind: "link" });
  const router = useRouter();

  const onCreated = useCallback(
    (id: string) => {
      onOpenChange(false);
      toast("Job added", { action: { label: "Open", onClick: () => router.push(`/jobs/${id}`) } });
    },
    [onOpenChange, router],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size={step.kind === "form" ? "lg" : "md"}
      title="Add a job"
      description={step.kind === "link" ? "Paste the posting link and Jobbier fills in what it can." : "Check the details, then add it."}
    >
      {step.kind === "link" ? (
        <LinkStep onDone={(defaults, imported, importError) => setStep({ kind: "form", defaults, imported, importError })} />
      ) : (
        <FormStep step={step} onBack={() => setStep({ kind: "link" })} onCreated={onCreated} onCancel={() => onOpenChange(false)} />
      )}
    </Dialog>
  );
}

function LinkStep({ onDone }: { onDone: (defaults: JobDefaults, imported?: ImportResult, error?: string) => void }) {
  const [url, setUrl] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    start(async () => {
      const result = await importJobAction(url);
      if (result.ok) {
        const d = result.data;
        onDone(
          {
            title: d.title ?? undefined,
            company: d.company ?? undefined,
            location: d.location,
            workMode: d.workMode,
            payMin: d.payMin,
            payMax: d.payMax,
            payPeriod: d.payPeriod ?? "year",
            currency: d.currency ?? "USD",
            description: d.description,
            url: d.url,
          },
          d,
        );
      } else {
        onDone({ url: url.trim() }, undefined, result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="add-job-url" className="sr-only">
          Link to the job posting
        </label>
        <div className="relative">
          <Link2 aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-3" />
          <Input
            id="add-job-url"
            data-autofocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="url"
            inputMode="url"
            placeholder="https://jobs.example.com/…"
            className="h-12 pl-10 text-base"
            disabled={pending}
          />
        </div>
        <Button type="submit" variant="primary" size="lg" pending={pending} disabled={!url.trim()}>
          {pending ? "Reading the page…" : "Fill in details"}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs text-ink-3">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <Button onClick={() => onDone({ url: url.trim() || null })} disabled={pending}>
        Enter details by hand
      </Button>
      <p className="text-xs text-ink-3">Works with most job boards and career sites — Greenhouse, Lever, Ashby, Workday and more.</p>
    </div>
  );
}

function FormStep({
  step,
  onBack,
  onCreated,
  onCancel,
}: {
  step: Extract<Step, { kind: "form" }>;
  onBack: () => void;
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useFormAction(createJobAction);

  useEffect(() => {
    if (state?.ok) onCreated(state.data.id);
  }, [state, onCreated]);

  const host = displayHost(step.imported?.url);
  const duplicate = step.imported?.duplicate;

  return (
    <form onSubmit={action} className="flex flex-col gap-5">
      {step.importError ? (
        <Notice tone="warn">{step.importError}</Notice>
      ) : host ? (
        <Notice tone="info">Filled in from {host}. Give it a quick check.</Notice>
      ) : null}
      {duplicate ? (
        <Notice tone="warn">
          You already added this: {duplicate.title} at {duplicate.company}.{" "}
          <Link href={`/jobs/${duplicate.id}`} onClick={onCancel} className="font-medium underline underline-offset-2">
            Open it
          </Link>
        </Notice>
      ) : null}

      <JobFields defaults={step.defaults} errors={state && !state.ok ? state.fieldErrors : undefined} showStage />
      <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />

      <DialogActions>
        <Button variant="ghost" icon={<ArrowLeft />} onClick={onBack} disabled={pending}>
          Back
        </Button>
        <Button type="submit" variant="primary" className="ml-auto" pending={pending}>
          Add job
        </Button>
      </DialogActions>
    </form>
  );
}

function Notice({ tone, children }: { tone: "info" | "warn"; children: ReactNode }) {
  return (
    <p
      className={
        tone === "warn"
          ? "flex gap-2 rounded-md bg-highlight-soft px-3 py-2 text-sm text-ink"
          : "rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-2"
      }
    >
      {tone === "warn" ? <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> : null}
      <span>{children}</span>
    </p>
  );
}
