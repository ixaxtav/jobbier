import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get } from "@vercel/blob";

/**
 * File storage. Production uses the private Vercel Blob store (uploads go
 * straight from the browser to Blob; downloads are streamed through an
 * authenticated route). Without a Blob token — local dev and tests — files
 * live in ./.uploads so the whole app works offline.
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "application/rtf",
  "image/png",
  "image/jpeg",
];

export const usesBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const LOCAL_ROOT = path.join(process.cwd(), ".uploads");

function localPath(key: string) {
  const resolved = path.resolve(LOCAL_ROOT, key);
  if (!resolved.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid storage key");
  return resolved;
}

/** Storage keys are always namespaced by user: `users/<userId>/<random>-<name>`. */
export function isKeyOwnedBy(key: string, userId: string) {
  return key.startsWith(`users/${userId}/`);
}

export async function saveLocalFile(key: string, data: ArrayBuffer) {
  if (usesBlob()) throw new Error("Local storage is only for development");
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(data));
}

export async function readFileStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
  if (usesBlob()) {
    const result = await get(key, { access: "private" });
    return result?.stream ?? null;
  }
  try {
    const buffer = await readFile(localPath(key));
    return new Blob([buffer]).stream();
  } catch {
    return null;
  }
}

export async function removeFile(key: string) {
  if (usesBlob()) {
    await del(key).catch(() => undefined);
    return;
  }
  await rm(localPath(key), { force: true });
}

export function safeFileName(name: string) {
  const base = name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").slice(-80);
  return base || "file";
}
