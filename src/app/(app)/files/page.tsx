import type { Metadata } from "next";
import { listDocuments } from "@/data/documents";
import { requireUser } from "@/lib/auth/session";
import { usesBlob } from "@/lib/storage";
import { FilesLibrary } from "@/components/files/files-library";

export const metadata: Metadata = { title: "Files" };

export default async function FilesPage() {
  const user = await requireUser();
  const rows = await listDocuments(user.id);
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Files</h1>
        <p className="mt-1 max-w-xl text-ink-2">Résumés, cover letters and portfolios. Attach them to jobs from a job&rsquo;s page.</p>
      </header>
      <FilesLibrary rows={rows} userId={user.id} mode={usesBlob() ? "blob" : "local"} />
    </div>
  );
}
