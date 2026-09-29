"use client";

import { useFormAction } from "@/lib/client/use-form-action";
import { Download, FileText, MoreHorizontal, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteDocumentAction, updateDocumentAction } from "@/actions/documents";
import type { Document, DocumentKind } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/dates";
import { formatBytes, pluralize } from "@/lib/format";
import { DOCUMENT_KIND_LABEL, DOCUMENT_KINDS } from "./document-kind";
import { ACCEPT, uploadDocument, type StorageMode } from "./upload";

type Row = { document: Document; jobCount: number };

export function FilesLibrary({ rows, userId, mode }: { rows: Row[]; userId: string; mode: StorageMode }) {
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function handle(files: FileList | File[]) {
    const list = Array.from(files);
    setUploading((u) => [...u, ...list.map((f) => f.name)]);
    await Promise.all(
      list.map(async (file) => {
        const result = await uploadDocument({ file, userId, mode });
        setUploading((u) => u.filter((n) => n !== file.name));
        if (result.ok) toast(`Uploaded ${file.name}`);
        else toast.error(result.error);
      }),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) void handle(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-start gap-3 rounded-lg border-2 border-dashed px-5 py-6 transition-colors sm:flex-row sm:items-center",
          dragOver ? "border-ink bg-surface-2" : "border-line-strong",
        )}
      >
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
          <Upload className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-medium">Drop files here, or choose them</p>
          <p className="text-sm text-ink-2">PDF, Word, text or images, up to 10 MB each. Only you can see them.</p>
        </div>
        <Button variant="ink" onClick={() => input.current?.click()}>
          Choose files
        </Button>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            if (e.target.files?.length) void handle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploading.length ? (
        <ul aria-live="polite" className="flex flex-col gap-2">
          {uploading.map((name) => (
            <li key={name} className="flex items-center gap-3 rounded-md bg-surface-2 px-4 py-2.5 text-sm text-ink-2">
              <Spinner /> Uploading {name}…
            </li>
          ))}
        </ul>
      ) : null}

      {rows.length === 0 && uploading.length === 0 ? (
        <p className="text-ink-2">
          No files yet. Upload each version of your résumé and cover letters, then attach the one you sent to each job so you always know what they saw.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {rows.map((row) => (
            <FileRow key={row.document.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FileRow({ row }: { row: Row }) {
  const { document: doc, jobCount } = row;
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  return (
    <li className="relative flex items-center gap-3 px-4 py-3 hover:bg-surface-2/40">
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-3">
        <FileText className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <a href={`/api/files/${doc.id}`} target="_blank" rel="noopener" className="block truncate font-medium after:absolute after:inset-0">
          {doc.name}
        </a>
        <p className="text-xs text-ink-3" suppressHydrationWarning>
          {DOCUMENT_KIND_LABEL[doc.kind]}, {formatBytes(doc.size)}, added {formatRelative(doc.createdAt)}
          {jobCount ? `, sent with ${pluralize(jobCount, "job")}` : ""}
        </p>
      </div>
      <a
        href={`/api/files/${doc.id}?download=1`}
        className="relative z-10 flex size-8 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink"
        aria-label={`Download ${doc.name}`}
        title="Download"
      >
        <Download className="size-4" />
      </a>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" aria-label={`Options for ${doc.name}`} disabled={pending} className="relative z-10 flex size-8 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink">
            {pending ? <Spinner /> : <MoreHorizontal className="size-4" />}
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={() => setRenaming(true)}>Rename</MenuItem>
          <MenuSeparator />
          <MenuItem destructive onSelect={() => setConfirmDelete(true)}>
            Delete
          </MenuItem>
        </MenuContent>
      </Menu>

      {renaming ? <RenameDialog doc={doc} onClose={() => setRenaming(false)} /> : null}
      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        size="sm"
        title={`Delete ${doc.name}?`}
        description={jobCount ? `It's attached to ${pluralize(jobCount, "job")}. It'll be removed from ${jobCount === 1 ? "it" : "them"} too.` : "This can't be undone."}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
          <Button
            variant="danger"
            data-autofocus
            onClick={() => {
              setConfirmDelete(false);
              start(async () => {
                const result = await deleteDocumentAction(doc.id);
                if (result.ok) toast(`Deleted ${doc.name}`);
                else toast.error(result.error);
              });
            }}
          >
            Delete file
          </Button>
        </div>
      </Dialog>
    </li>
  );
}

function RenameDialog({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const [state, action, pending] = useFormAction(async (_: unknown, form: FormData) => {
    const result = await updateDocumentAction(doc.id, String(form.get("name") ?? ""), String(form.get("kind") ?? ""));
    if (result.ok) onClose();
    return result;
  });
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Rename file" size="sm">
      <form onSubmit={action} className="flex flex-col gap-4">
        <Field label="Name" error={errors.name}>
          {(p) => <Input {...p} name="name" defaultValue={doc.name} required />}
        </Field>
        <Field label="Kind">
          {(p) => (
            <Select {...p} name="kind" defaultValue={doc.kind}>
              {DOCUMENT_KINDS.map((k: DocumentKind) => (
                <option key={k} value={k}>
                  {DOCUMENT_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="ink" pending={pending}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
