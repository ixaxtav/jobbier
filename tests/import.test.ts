import { describe, expect, it } from "vitest";
import { isPrivateAddress, normalizeUrl } from "@/lib/import/fetch-page";
import { htmlToText, parseJobPage, splitTitle } from "@/lib/import/parse-job";

const page = (head: string) => `<!doctype html><html><head>${head}</head><body></body></html>`;

describe("parseJobPage", () => {
  it("reads a schema.org JobPosting", () => {
    const ld = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Senior Frontend Engineer",
      hiringOrganization: { "@type": "Organization", name: "Acme &amp; Co" },
      jobLocation: [{ "@type": "Place", address: { addressLocality: "Miami", addressRegion: "FL" } }],
      baseSalary: { currency: "USD", value: { minValue: 140000, maxValue: 170000, unitText: "YEAR" } },
      description: "&lt;p&gt;Build things.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;React&lt;/li&gt;&lt;/ul&gt;",
    };
    const job = parseJobPage(page(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`), "https://x.test/j");
    expect(job).toMatchObject({
      title: "Senior Frontend Engineer",
      company: "Acme & Co",
      location: "Miami, FL",
      payMin: 140000,
      payMax: 170000,
      payPeriod: "year",
      currency: "USD",
      workMode: null,
    });
    expect(job.description).toBe("Build things.\n\n• React");
  });

  it("finds a JobPosting inside @graph and detects remote + hourly pay", () => {
    const ld = {
      "@graph": [
        { "@type": "WebPage" },
        {
          "@type": "JobPosting",
          title: "Support Specialist",
          hiringOrganization: "Globex",
          jobLocationType: "TELECOMMUTE",
          baseSalary: { value: { value: 32, unitText: "HOUR" } },
        },
      ],
    };
    const job = parseJobPage(page(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`), "https://x.test");
    expect(job).toMatchObject({ company: "Globex", workMode: "remote", location: "Remote", payMin: 32, payMax: null, payPeriod: "hour" });
  });

  it("annualises monthly salaries", () => {
    const ld = { "@type": "JobPosting", title: "Designer", baseSalary: { value: { minValue: 5000, maxValue: 6000, unitText: "MONTH" } } };
    const job = parseJobPage(page(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`), "https://x.test");
    expect(job).toMatchObject({ payMin: 60000, payMax: 72000, payPeriod: "year" });
  });

  it("falls back to Open Graph and survives broken JSON-LD", () => {
    const job = parseJobPage(
      page(`<script type="application/ld+json">{nope</script>
        <meta property="og:title" content="Product Designer at Initech | LinkedIn">
        <meta property="og:description" content="Join us (hybrid).">`),
      "https://linkedin.com/jobs/1",
    );
    expect(job).toMatchObject({ title: "Product Designer", company: "Initech", description: "Join us (hybrid)." });
  });
});

describe("parseJobPage fallbacks", () => {
  it("reads Greenhouse's new job boards (company in <title>, location in og:description)", () => {
    const job = parseJobPage(
      page(`<meta property="og:title" content="Account Executive, Commercial"/>
        <meta property="og:description" content="Hybrid - London"/>
        <title>Job Application for Account Executive, Commercial at Vercel</title>`) + `<script>window.x={"company_name":"Vercel","job_post_location":"Hybrid - London"}</script>`,
      "https://job-boards.greenhouse.io/vercel/jobs/1",
    );
    expect(job).toMatchObject({ title: "Account Executive, Commercial", company: "Vercel", location: "London", workMode: "hybrid", description: null });
  });
});

describe("splitTitle", () => {
  it.each([
    ["Job Application for Data Analyst at Umbrella", null, "Data Analyst", "Umbrella"],
    ["Hooli - Staff Software Engineer", null, "Staff Software Engineer", "Hooli"],
    ["Line Cook - Pied Piper - Indeed.com", null, "Line Cook", "Pied Piper"],
    ["Careers", "Acme", "Careers", null],
  ])("%s", (raw, site, title, company) => {
    expect(splitTitle(raw, site)).toEqual({ title, company });
  });
});

describe("htmlToText", () => {
  it("keeps structure and caps length", () => {
    expect(htmlToText("<p>One</p><p>Two<br>Three</p>")).toBe("One\nTwo\nThree");
    expect(htmlToText("")).toBeNull();
    expect(htmlToText("a".repeat(25_000))!.length).toBe(20_001);
  });
});

describe("import safety", () => {
  it("blocks private and local addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1", "0.0.0.0"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "172.32.0.1", "2606:4700::1111"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("normalises links and rejects other protocols", () => {
    expect(normalizeUrl("jobs.lever.co/acme/1").toString()).toBe("https://jobs.lever.co/acme/1");
    expect(() => normalizeUrl("ftp://x.test")).toThrow();
    expect(() => normalizeUrl("https://user:pw@x.test")).toThrow();
  });
});
