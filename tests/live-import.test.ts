// Network test against real job boards. Opt-in: LIVE=1 npx vitest run tests/live-import.test.ts
import { describe, expect, it } from "vitest";
import { fetchPublicPage } from "@/lib/import/fetch-page";
import { parseJobPage } from "@/lib/import/parse-job";

describe.runIf(process.env.LIVE)("live import", () => {
  it.each(["https://job-boards.greenhouse.io/vercel/jobs/6136160004", "https://jobs.ashbyhq.com/linear/d3bc1ced-3ce4-4086-a050-555055dbb1ff", "https://jobs.lever.co/spotify/2193db3f-77c5-43b8-b030-8f92c9882bf1"])("%s", async (url) => {
    const page = await fetchPublicPage(url);
    const job = parseJobPage(page.html, page.url);
    console.log(JSON.stringify({ ...job, description: job.description?.slice(0, 100) }, null, 1));
    expect(job.title || job.company).toBeTruthy();
  }, 20_000);

  it("refuses the cloud metadata address", async () => {
    await expect(fetchPublicPage("http://169.254.169.254/latest")).rejects.toThrow(/private/);
  });

  it("refuses public hostnames that resolve to private addresses (checked at connect time)", async () => {
    await expect(fetchPublicPage("http://127.0.0.1.nip.io/")).rejects.toThrow(/private/);
  });
});
