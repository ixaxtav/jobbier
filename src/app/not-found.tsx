import { Wordmark } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-5">
      <Wordmark />
      <h1 className="mt-6 text-2xl font-bold">There&rsquo;s nothing at this address</h1>
      <p className="text-ink-2">The link may be old, or the page was moved.</p>
      <ButtonLink href="/today" variant="ink">
        Go to Today
      </ButtonLink>
    </div>
  );
}
