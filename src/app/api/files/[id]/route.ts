import { NextResponse } from "next/server";
import { getDocument } from "@/data/documents";
import { getCurrentUser } from "@/lib/auth/session";
import { readFileStream } from "@/lib/storage";

/** Streams a private file to its owner. `?download=1` forces a download instead of opening inline. */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in to view this file", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

  const doc = await getDocument(user.id, id);
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const stream = await readFileStream(doc.storageKey);
  if (!stream) return new NextResponse("This file is missing from storage", { status: 410 });

  const download = new URL(request.url).searchParams.has("download");
  // Names are stored without an extension ("Resume 2026"); the stored key keeps the real one.
  const ext = /\.[a-z0-9]{1,5}$/i.exec(doc.storageKey)?.[0] ?? "";
  const filename = ext && !doc.name.toLowerCase().endsWith(ext.toLowerCase()) ? `${doc.name}${ext}` : doc.name;
  const isPdf = doc.contentType === "application/pdf";
  const inlineSafe = doc.contentType === "application/pdf" || doc.contentType.startsWith("image/") || doc.contentType === "text/plain";
  const disposition = download || !inlineSafe ? "attachment" : "inline";

  return new NextResponse(stream, {
    headers: {
      "content-type": doc.contentType,
      "content-length": String(doc.size),
      "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      // Uploaded files never get to run scripts in our origin. (Chrome's PDF viewer refuses to
      // render under `sandbox`, so PDFs get a no-scripts policy without it.)
      "content-security-policy": isPdf ? "default-src 'none'; object-src 'self'; frame-ancestors 'none'" : "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
