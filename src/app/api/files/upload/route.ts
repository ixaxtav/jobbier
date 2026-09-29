import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ALLOWED_TYPES, MAX_FILE_BYTES, isKeyOwnedBy, usesBlob } from "@/lib/storage";

/**
 * Issues short-lived tokens so the browser can upload straight to the private
 * Blob store (bypassing the 4.5 MB function body limit). The file is registered
 * in the database afterwards by `registerDocumentAction`, which re-checks it.
 */
export async function POST(request: Request) {
  if (!usesBlob()) return NextResponse.json({ error: "Blob storage isn't configured" }, { status: 501 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in again to upload" }, { status: 401 });

  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!isKeyOwnedBy(pathname, user.id)) throw new Error("Invalid upload path");
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 10 * 60_000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 });
  }
}
