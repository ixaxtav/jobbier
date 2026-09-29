import { ButtonLink } from "@/components/ui/button";

export default function JobNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 py-16">
      <h1 className="text-2xl font-bold">That job isn&rsquo;t here</h1>
      <p className="text-ink-2">It may have been deleted, or the link belongs to someone else&rsquo;s account.</p>
      <ButtonLink href="/jobs" variant="ink">
        Back to jobs
      </ButtonLink>
    </div>
  );
}
