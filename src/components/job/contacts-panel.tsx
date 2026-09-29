"use client";

import { useFormAction } from "@/lib/client/use-form-action";
import { Link2, Mail, MoreHorizontal, Plus, UserRound } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteContactAction, saveContactAction } from "@/actions/details";
import type { Contact } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { displayHost, initials } from "@/lib/format";

/** The recruiter, the hiring manager, the friend who referred you. */
export function ContactsPanel({ jobId, contacts }: { jobId: string; contacts: Contact[] }) {
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  return (
    <section aria-labelledby="people-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="people-heading" className="text-lg font-semibold">
          People
        </h2>
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setEditing("new")}>
          Add
        </Button>
      </div>
      {contacts.length === 0 ? (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-4 text-left text-sm text-ink-2 hover:border-ink-3 hover:text-ink"
        >
          <UserRound aria-hidden className="size-5 shrink-0 text-ink-3" />
          Keep track of who you&rsquo;re talking to — recruiter, hiring manager, referral.
        </button>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {contacts.map((c) => (
            <ContactRow key={c.id} contact={c} onEdit={() => setEditing(c)} />
          ))}
        </ul>
      )}
      {editing ? (
        <ContactDialog key={editing === "new" ? "new" : editing.id} jobId={jobId} contact={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
    </section>
  );
}

function ContactRow({ contact, onEdit }: { contact: Contact; onEdit: () => void }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-start gap-3 px-3.5 py-3">
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-2xs font-semibold text-ink-2">
        {initials(contact.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{contact.name}</p>
        {contact.role ? <p className="text-sm text-ink-2">{contact.role}</p> : null}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
              <Mail aria-hidden className="size-3.5" />
              {contact.email}
            </a>
          ) : null}
          {contact.url ? (
            <a href={contact.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
              <Link2 aria-hidden className="size-3.5" />
              {displayHost(contact.url)}
            </a>
          ) : null}
        </div>
        {contact.notes ? <p className="mt-1.5 text-sm whitespace-pre-wrap text-ink-2">{contact.notes}</p> : null}
      </div>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" aria-label={`Options for ${contact.name}`} disabled={pending} className="-mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink">
            <MoreHorizontal className="size-4" />
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onEdit}>Edit</MenuItem>
          <MenuSeparator />
          <MenuItem
            destructive
            onSelect={() =>
              start(async () => {
                const result = await deleteContactAction(contact.id);
                if (result.ok) toast("Removed");
                else toast.error(result.error);
              })
            }
          >
            Remove
          </MenuItem>
        </MenuContent>
      </Menu>
    </li>
  );
}

function ContactDialog({ jobId, contact, onClose }: { jobId: string; contact: Contact | null; onClose: () => void }) {
  const [state, action, pending] = useFormAction(saveContactAction.bind(null, contact?.id ?? null));
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={contact ? "Edit person" : "Add a person"} size="sm">
      <form onSubmit={action} className="flex flex-col gap-4">
        <input type="hidden" name="jobId" value={jobId} />
        <Field label="Name" error={errors.name}>
          {(p) => <Input {...p} name="name" defaultValue={contact?.name ?? ""} required autoComplete="off" />}
        </Field>
        <Field label="Role" error={errors.role}>
          {(p) => <Input {...p} name="role" defaultValue={contact?.role ?? ""} placeholder="Recruiter" autoComplete="off" />}
        </Field>
        <Field label="Email" error={errors.email}>
          {(p) => <Input {...p} name="email" type="email" defaultValue={contact?.email ?? ""} autoComplete="off" />}
        </Field>
        <Field label="Profile link" hint="LinkedIn or anywhere else" error={errors.url}>
          {(p) => <Input {...p} name="url" type="url" defaultValue={contact?.url ?? ""} placeholder="https://" />}
        </Field>
        <Field label="Notes" error={errors.notes}>
          {(p) => <Textarea {...p} name="notes" defaultValue={contact?.notes ?? ""} rows={2} />}
        </Field>
        <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="ink" pending={pending}>
            {contact ? "Save changes" : "Add person"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
