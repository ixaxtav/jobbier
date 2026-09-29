"use client";

import { useFormAction } from "@/lib/client/use-form-action";
import { MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteJobAction, updateJobAction } from "@/actions/jobs";
import { sendLeadAction } from "@/actions/leads";
import type { Job } from "@/db/schema";
import { JobFields } from "@/components/jobs/job-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field, FormError, Textarea } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

type Friend = { id: string; name: string; email: string };

export function JobActions({ job, friends }: { job: Job; friends: Friend[] }) {
  const [dialog, setDialog] = useState<"edit" | "share" | "delete" | null>(null);
  const close = () => setDialog(null);
  return (
    <div className="flex items-center gap-2">
      <Button icon={<Pencil />} onClick={() => setDialog("edit")} className="max-sm:hidden">
        Edit
      </Button>
      <Button icon={<Send />} onClick={() => setDialog("share")} className="max-sm:hidden">
        Send to a friend
      </Button>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" aria-label="More actions" className="flex size-10 items-center justify-center rounded-md border border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink">
            <MoreHorizontal className="size-[18px]" />
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem icon={<Pencil />} onSelect={() => setDialog("edit")} className="sm:hidden">
            Edit
          </MenuItem>
          <MenuItem icon={<Send />} onSelect={() => setDialog("share")} className="sm:hidden">
            Send to a friend
          </MenuItem>
          <MenuSeparator className="sm:hidden" />
          <MenuItem destructive icon={<Trash2 />} onSelect={() => setDialog("delete")}>
            Delete job
          </MenuItem>
        </MenuContent>
      </Menu>

      {dialog === "edit" ? <EditDialog job={job} onClose={close} /> : null}
      {dialog === "share" ? <ShareDialog job={job} friends={friends} onClose={close} /> : null}
      <DeleteDialog job={job} open={dialog === "delete"} onClose={close} />
    </div>
  );
}

function EditDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const [state, action, pending] = useFormAction(updateJobAction.bind(null, job.id));
  useEffect(() => {
    if (state?.ok) {
      toast("Saved");
      onClose();
    }
  }, [state, onClose]);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Edit job" size="lg">
      <form onSubmit={action} className="flex flex-col gap-5">
        <JobFields defaults={job} errors={state && !state.ok ? state.fieldErrors : undefined} />
        <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
        <DialogActions className="justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="ink" pending={pending}>
            Save changes
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function ShareDialog({ job, friends, onClose }: { job: Job; friends: Friend[]; onClose: () => void }) {
  const [state, action, pending] = useFormAction(sendLeadAction);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    if (state?.ok) {
      toast(state.data.message);
      onClose();
    }
  }, [state, onClose]);

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Send to a friend"
      description={`They'll get ${job.title} at ${job.company} in their Leads, with your note. Your own notes and files stay private.`}
      size="sm"
    >
      {friends.length === 0 ? (
        <div className="flex flex-col gap-4">
          <p className="text-ink-2">Nobody else has joined your Jobbier yet. Share the invite code from Settings and they can sign up.</p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={action} className="flex flex-col gap-4">
          <input type="hidden" name="jobId" value={job.id} />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Who should see it?</legend>
            <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
              {friends.map((f) => {
                const checked = selected.includes(f.id);
                return (
                  <li key={f.id}>
                    <label className={cn("flex items-center gap-3 rounded-md border px-3 py-2.5", checked ? "border-ink bg-surface-2" : "border-line hover:border-line-strong")}>
                      <input
                        type="checkbox"
                        name="toUserIds"
                        value={f.id}
                        checked={checked}
                        onChange={(e) => setSelected((s) => (e.target.checked ? [...s, f.id] : s.filter((x) => x !== f.id)))}
                        className="size-4 accent-ink"
                      />
                      <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-ink text-2xs font-semibold text-bg">
                        {initials(f.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{f.name}</span>
                        <span className="block truncate text-xs text-ink-3">{f.email}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {state && !state.ok && state.fieldErrors?.toUserIds ? <p className="mt-1.5 text-xs font-medium text-danger">{state.fieldErrors.toUserIds}</p> : null}
          </fieldset>
          <Field label="Add a note" hint="Optional" error={state && !state.ok ? state.fieldErrors?.note : undefined}>
            {(p) => <Textarea {...p} name="note" rows={2} placeholder="Saw this and thought of you" />}
          </Field>
          <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="ink" pending={pending} disabled={selected.length === 0}>
              Send lead
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function DeleteDialog({ job, open, onClose }: { job: Job; open: boolean; onClose: () => void }) {
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="Delete this job?" description={`${job.title} at ${job.company}, with its log, schedule and people. Files stay in your library.`} size="sm">
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Keep it
        </Button>
        <Button variant="danger" data-autofocus pending={pending} onClick={() => start(async () => void (await deleteJobAction(job.id)))}>
          Delete job
        </Button>
      </div>
    </Dialog>
  );
}
