import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ALLOWED_TYPES, MAX_FILE_BYTES, isKeyOwnedBy, saveLocalFile, usesBlob } from "@/lib/storage";

/** Development-only stand-in for Blob client uploads: stores the file in ./.uploads. */
export async function POST(request: Request) {
  if (usesBlob() || process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in again to upload" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const key = String(form.get("key") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!isKeyOwnedBy(key, user.id)) return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Files can be up to 10 MB" }, { status: 413 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "That file type isn’t supported" }, { status: 415 });

  await saveLocalFile(key, await file.arrayBuffer());
  return NextResponse.json({ pathname: key });
}
