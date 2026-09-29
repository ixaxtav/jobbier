"use client";

import { upload } from "@vercel/blob/client";
import { registerDocumentAction } from "@/actions/documents";
import type { DocumentKind } from "@/db/schema";

export const MAX_BYTES = 10 * 1024 * 1024;
export const ACCEPT = ".pdf,.doc,.docx,.txt,.md,.rtf,.png,.jpg,.jpeg";
const TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "application/rtf",
  "image/png",
  "image/jpeg",
]);

export type StorageMode = "blob" | "local";

export function guessKind(name: string): DocumentKind {
  if (/cover/i.test(name)) return "cover_letter";
  if (/(resume|résumé|\bcv\b)/i.test(name)) return "resume";
  if (/portfolio|case.?study/i.test(name)) return "portfolio";
  return "resume";
}

function contentTypeFor(file: File) {
  if (file.type) return file.type;
  // Some browsers leave .md/.rtf untyped.
  if (/\.md$/i.test(file.name)) return "text/markdown";
  if (/\.rtf$/i.test(file.name)) return "application/rtf";
  return "";
}

/** Checks the file, uploads it, and registers it. Returns the new document id. */
export async function uploadDocument({
  file,
  userId,
  mode,
  kind,
  attachToJobId,
}: {
  file: File;
  userId: string;
  mode: StorageMode;
  kind?: DocumentKind;
  attachToJobId?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const type = contentTypeFor(file);
  if (file.size > MAX_BYTES) return { ok: false, error: `${file.name} is over 10 MB.` };
  if (!TYPES.has(type)) return { ok: false, error: `${file.name} isn't a PDF, Word, text, or image file.` };

  const safe = file.name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").slice(-80) || "file";
  const key = `users/${userId}/${crypto.randomUUID()}-${safe}`;

  try {
    if (mode === "blob") {
      await upload(key, file, { access: "private", handleUploadUrl: "/api/files/upload", contentType: type, multipart: file.size > 5 * 1024 * 1024 });
    } else {
      const body = new FormData();
      body.set("file", new File([file], file.name, { type }));
      body.set("key", key);
      const res = await fetch("/api/files/local", { method: "POST", body });
      if (!res.ok) return { ok: false, error: ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Upload failed." };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.message ? `Upload failed: ${error.message}` : "Upload failed. Check your connection and try again." };
  }

  const name = file.name.replace(/\.[^.]+$/, "") || file.name;
  const result = await registerDocumentAction({ key, name, kind: kind ?? guessKind(file.name), attachToJobId: attachToJobId ?? null });
  return result.ok ? { ok: true, id: result.data.id } : { ok: false, error: result.error };
}
