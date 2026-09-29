"use client";

import { FileText, Paperclip, Plus, Upload, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { attachDocumentAction, detachDocumentAction } from "@/actions/details";
import type { Document } from "@/db/schema";
import { DOCUMENT_KIND_LABEL } from "@/components/files/document-kind";
import { ACCEPT, uploadDocument, type StorageMode } from "@/components/files/upload";
import { Button, IconButton } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";

/** Which résumé and cover letter went with this application. */
export function FilesPanel({
  jobId,
  attached,
  library,
  userId,
  mode,
}: {
  jobId: string;
  attached: Document[];
  library: Document[];
  userId: string;
  mode: StorageMode;
}) {
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const attachedIds = new Set(attached.map((d) => d.id));
  const available = library.filter((d) => !attachedIds.has(d.id));

  async function upload(file: File) {
    setUploading(true);
    const result = await uploadDocument({ file, userId, mode, attachToJobId: jobId });
    setUploading(false);
    if (result.ok) toast(`Attached ${file.name}`);
    else toast.error(result.error);
  }

  return (
    <section aria-labelledby="files-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="files-heading" className="text-lg font-semibold">
          Sent with it
        </h2>
        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" variant="ghost" icon={uploading || pending ? <Spinner /> : <Plus />} disabled={uploading}>
              Attach
            </Button>
          </MenuTrigger>
          <MenuContent>
            {available.length ? (
              <>
                <MenuLabel>From your files</MenuLabel>
                {available.slice(0, 8).map((d) => (
                  <MenuItem
                    key={d.id}
                    icon={<FileText />}
                    onSelect={() =>
                      start(async () => {
                        const result = await attachDocumentAction(jobId, d.id);
                        if (!result.ok) toast.error(result.error);
                      })
                    }
                  >
                    <span className="truncate">{d.name}</span>
                  </MenuItem>
                ))}
                <MenuSeparator />
              </>
            ) : null}
            <MenuItem icon={<Upload />} onSelect={() => input.current?.click()}>
              Upload a new file…
            </MenuItem>
          </MenuContent>
        </Menu>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
      </div>

      {attached.length === 0 ? (
        <p className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-4 text-sm text-ink-2">
          <Paperclip aria-hidden className="size-5 shrink-0 text-ink-3" />
          Attach the résumé and cover letter you sent, so you know what they saw.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {attached.map((d) => (
            <li key={d.id} className="relative flex items-center gap-3 px-3.5 py-2.5">
              <FileText aria-hidden className="size-4 shrink-0 text-ink-3" />
              <div className="min-w-0 flex-1">
                <a href={`/api/files/${d.id}`} target="_blank" rel="noopener" className="block truncate text-sm font-medium after:absolute after:inset-0">
                  {d.name}
                </a>
                <p className="text-xs text-ink-3">{DOCUMENT_KIND_LABEL[d.kind]}</p>
              </div>
              <IconButton
                size="sm"
                label={`Detach ${d.name}`}
                className="relative z-10"
                onClick={() =>
                  start(async () => {
                    const result = await detachDocumentAction(jobId, d.id);
                    if (!result.ok) toast.error(result.error);
                  })
                }
              >
                <X />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
