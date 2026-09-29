"use server";

import { stat } from "node:fs/promises";
import path from "node:path";
import { head } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { attachDocument, createDocument, deleteDocument, renameDocument } from "@/data/documents";
import { NotFoundError } from "@/data/jobs";
import { requireUser } from "@/lib/auth/session";
import { ALLOWED_TYPES, MAX_FILE_BYTES, isKeyOwnedBy, removeFile, usesBlob } from "@/lib/storage";
import { documentKindInput, fail, invalid, ok, isId, badId, type ActionResult } from "@/lib/validation";

const registerInput = z.object({
  key: z.string().min(1).max(400),
  name: z.string().trim().min(1, "Give the file a name").max(160),
  kind: documentKindInput,
  attachToJobId: z.uuid().nullable().optional(),
});

/**
 * Called after the browser finished uploading. Trusts nothing from the client:
 * size and type are read back from storage.
 */
export async function registerDocumentAction(input: z.input<typeof registerInput>): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = registerInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { key, name, kind, attachToJobId } = parsed.data;
  if (!isKeyOwnedBy(key, user.id)) return fail("That upload doesn’t belong to you.");

  let size: number;
  let contentType: string;
  try {
    if (usesBlob()) {
      const blob = await head(key);
      size = blob.size;
      contentType = blob.contentType;
    } else {
      size = (await stat(path.join(process.cwd(), ".uploads", key))).size;
      contentType = guessType(key);
    }
  } catch {
    return fail("The upload didn’t finish. Try again.");
  }
  if (size > MAX_FILE_BYTES || !ALLOWED_TYPES.includes(contentType)) {
    await removeFile(key);
    return fail("Files must be PDF, Word, text, or images up to 10 MB.");
  }

  const doc = await createDocument(user.id, { name, kind, storageKey: key, contentType, size });
  if (attachToJobId) {
    await attachDocument(user.id, attachToJobId, doc.id).catch((e) => {
      if (!(e instanceof NotFoundError)) throw e;
    });
  }
  revalidatePath("/", "layout");
  return ok({ id: doc.id });
}

function guessType(key: string) {
  const ext = key.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    md: "text/markdown",
    rtf: "application/rtf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
}

export async function updateDocumentAction(documentId: string, name: string, kind: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(documentId)) return badId();
  const parsed = z.object({ name: z.string().trim().min(1, "Give the file a name").max(160), kind: documentKindInput }).safeParse({ name, kind });
  if (!parsed.success) return invalid(parsed.error);
  try {
    await renameDocument(user.id, documentId, parsed.data.name, parsed.data.kind);
  } catch (error) {
    if (error instanceof NotFoundError) return fail("That file no longer exists.");
    throw error;
  }
  revalidatePath("/", "layout");
  return ok();
}

export async function deleteDocumentAction(documentId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(documentId)) return badId();
  await deleteDocument(user.id, documentId);
  revalidatePath("/", "layout");
  return ok();
}
