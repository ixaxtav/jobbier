import { parse, type HTMLElement } from "node-html-parser";
import type { PayPeriod, WorkMode } from "@/db/schema";

export type ImportedJob = {
  title: string | null;
  company: string | null;
  location: string | null;
  workMode: WorkMode | null;
  payMin: number | null;
  payMax: number | null;
  payPeriod: PayPeriod | null;
  currency: string | null;
  description: string | null;
  url: string;
};

type JsonLd = Record<string, unknown>;

/**
 * Pulls job details out of a posting page. Most applicant tracking systems
 * (Greenhouse, Lever, Ashby, Workday, LinkedIn…) embed a schema.org JobPosting
 * as JSON-LD; everything else falls back to Open Graph and <title> heuristics.
 */
export function parseJobPage(html: string, url: string): ImportedJob {
  const root = parse(html, { blockTextElements: { script: true, style: false } });
  const posting = findJobPosting(root);
  const fromMeta = fromMetaTags(root, url, html);

  if (!posting) return fromMeta;

  const salary = parseSalary(posting.baseSalary ?? posting.estimatedSalary);
  const remote = String(posting.jobLocationType ?? "").toUpperCase().includes("TELECOMMUTE");

  return {
    url,
    title: clean(asString(posting.title)) ?? fromMeta.title,
    company: clean(orgName(posting.hiringOrganization)) ?? fromMeta.company,
    location: formatLocations(posting.jobLocation) ?? (remote ? "Remote" : fromMeta.location),
    workMode: remote ? "remote" : guessWorkMode(`${asString(posting.title) ?? ""} ${formatLocations(posting.jobLocation) ?? ""}`),
    ...salary,
    description: htmlToText(asString(posting.description)) ?? fromMeta.description,
  };
}

function findJobPosting(root: HTMLElement): JsonLd | null {
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent.trim());
    } catch {
      continue;
    }
    const found = walk(data);
    if (found) return found;
  }
  return null;
}

function walk(node: unknown): JsonLd | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = walk(item);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const obj = node as JsonLd;
    const type = obj["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return obj;
    if (obj["@graph"]) return walk(obj["@graph"]);
  }
  return null;
}

function fromMetaTags(root: HTMLElement, url: string, html: string): ImportedJob {
  const meta = (key: string) =>
    root.querySelector(`meta[property="${key}"]`)?.getAttribute("content") ??
    root.querySelector(`meta[name="${key}"]`)?.getAttribute("content") ??
    null;

  const siteName = clean(meta("og:site_name"));
  // Try og:title first, then <title>; keep whichever names the company.
  const candidates = [clean(meta("og:title")), clean(root.querySelector("title")?.textContent ?? null)]
    .filter((t): t is string => Boolean(t))
    .map((t) => splitTitle(t, siteName));
  const split = candidates.find((c) => c.company) ?? candidates[0] ?? { title: null, company: null };

  const description = clean(meta("og:description") ?? meta("description"));
  const hints = embeddedHints(html);
  // Some boards (Greenhouse) put only the location in the description: "Hybrid - London".
  const descriptionIsLocation = Boolean(
    description &&
      description.length <= 60 &&
      !/[.!?]/.test(description) &&
      !/\b(jobs?|careers?|hiring|openings|work at|join)\b/i.test(description) &&
      !candidates.some((c) => c.title === description),
  );
  const location = hints.location ?? (descriptionIsLocation ? description : null);

  return {
    url,
    title: split.title,
    company: split.company ?? hints.company ?? (siteName && !isJobBoard(siteName) ? siteName : null),
    location: location ? stripWorkMode(location) : null,
    workMode: guessWorkMode(`${location ?? ""} ${split.title ?? ""}`),
    payMin: null,
    payMax: null,
    payPeriod: null,
    currency: null,
    description: descriptionIsLocation ? null : description,
  };
}

/** A few applicant-tracking systems embed their data as JSON in the page. Pick out the obvious keys. */
function embeddedHints(html: string): { company: string | null; location: string | null } {
  const pick = (key: string) => {
    const match = new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]{1,120})"`).exec(html);
    return match ? clean(match[1]) : null;
  };
  return { company: pick("company_name"), location: pick("job_post_location") };
}

/** "Hybrid - London" → "London"; "Remote (US)" stays as is. */
function stripWorkMode(location: string) {
  const stripped = location.replace(/^(hybrid|on[- ]?site|in[- ]office)\s*[-–—:|]\s*/i, "").trim();
  return stripped || location;
}

const JOB_BOARDS = /linkedin|indeed|glassdoor|greenhouse|lever|ashby|workday|wellfound|angellist|ziprecruiter|monster|dice|builtin|otta|welcome to the jungle/i;

function isJobBoard(name: string) {
  return JOB_BOARDS.test(name);
}

/**
 * Titles come in a few shapes:
 *   "Job Application for Senior Engineer at Acme"   (Greenhouse)
 *   "Acme - Senior Engineer"                          (Lever)
 *   "Senior Engineer at Acme | LinkedIn"
 *   "Senior Engineer - Acme - Indeed.com"
 */
export function splitTitle(raw: string, siteName: string | null): { title: string | null; company: string | null } {
  let text = raw.replace(/^job application for\s+/i, "").trim();

  // Drop a trailing job-board or site suffix: "… | LinkedIn", "… - Indeed.com".
  const parts = text.split(/\s+[|–—-]\s+/);
  while (parts.length > 1 && (isJobBoard(parts[parts.length - 1]) || (siteName && parts[parts.length - 1] === siteName))) {
    parts.pop();
  }
  text = parts.join(" - ");

  const at = /^(.+?)\s+(?:at|@)\s+(.+)$/i.exec(text);
  if (at) return { title: at[1].trim(), company: at[2].trim() };

  if (parts.length >= 2) {
    // Lever puts the company first; most others put the title first. Company names
    // rarely contain role words, so pick the side that looks like a role.
    const [first, ...rest] = parts;
    const second = rest.join(" - ");
    return looksLikeRole(first) && !looksLikeRole(second)
      ? { title: first, company: second }
      : { title: second, company: first };
  }

  return { title: text || null, company: null };
}

const ROLE_WORDS =
  /\b(engineer|developer|designer|manager|lead|director|analyst|scientist|intern|associate|specialist|coordinator|consultant|architect|administrator|officer|head|vp|president|writer|editor|researcher|recruiter|representative|assistant|technician|nurse|teacher|server|bartender|cook|chef|product|marketing|sales|support|operations|staff|senior|junior|principal)\b/i;

function looksLikeRole(text: string) {
  return ROLE_WORDS.test(text);
}

export function guessWorkMode(text: string): WorkMode | null {
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (/\bremote\b/i.test(text)) return "remote";
  if (/\bon[- ]?site\b|\bin[- ]office\b/i.test(text)) return "onsite";
  return null;
}

function parseSalary(value: unknown): Pick<ImportedJob, "payMin" | "payMax" | "payPeriod" | "currency"> {
  const none = { payMin: null, payMax: null, payPeriod: null, currency: null };
  if (!value || typeof value !== "object") return none;
  const salary = (Array.isArray(value) ? value[0] : value) as JsonLd;
  const quantity = (salary.value ?? salary) as JsonLd;
  const unit = String(quantity.unitText ?? salary.unitText ?? "YEAR").toUpperCase();

  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  let min = num(quantity.minValue) ?? num(quantity.value);
  let max = num(quantity.maxValue) ?? (quantity.minValue == null ? null : num(quantity.value));
  if (min == null && max == null) return none;

  let period: PayPeriod = "year";
  if (unit === "HOUR") period = "hour";
  else if (unit === "MONTH") {
    min = min && min * 12;
    max = max && max * 12;
  } else if (unit === "WEEK") {
    min = min && min * 52;
    max = max && max * 52;
  }

  return {
    payMin: min == null ? null : Math.round(min),
    payMax: max == null || max === min ? null : Math.round(max),
    payPeriod: period,
    currency: typeof salary.currency === "string" && /^[A-Z]{3}$/.test(salary.currency) ? salary.currency : null,
  };
}

function orgName(org: unknown): string | null {
  if (typeof org === "string") return org;
  if (org && typeof org === "object") return asString((org as JsonLd).name);
  return null;
}

function formatLocations(value: unknown): string | null {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const names = list
    .map((loc) => {
      if (typeof loc === "string") return loc;
      const address = (loc as JsonLd)?.address;
      if (typeof address === "string") return address;
      if (!address || typeof address !== "object") return null;
      const a = address as JsonLd;
      const parts = [asString(a.addressLocality), asString(a.addressRegion)].filter(Boolean);
      if (parts.length === 0 && asString(a.addressCountry)) parts.push(asString(a.addressCountry));
      return parts.join(", ") || null;
    })
    .filter((s): s is string => Boolean(s));
  const unique = [...new Set(names)];
  if (unique.length === 0) return null;
  return unique.length > 2 ? `${unique.slice(0, 2).join(" / ")} +${unique.length - 2}` : unique.join(" / ");
}

function asString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "name" in value) return asString((value as JsonLd).name);
  return null;
}

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = decodeEntities(value).replace(/\s+/g, " ").trim();
  return text || null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

function decodeEntities(text: string) {
  return text.replace(/&(#x?[\da-f]+|\w+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Posting descriptions are HTML (sometimes entity-encoded HTML). Keep paragraphs and bullets, drop tags. */
export function htmlToText(html: string | null): string | null {
  if (!html) return null;
  let source = html;
  if (/&lt;\/?[a-z]/i.test(source)) source = decodeEntities(source);
  const text = decodeEntities(
    source
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\s*li[^>]*>/gi, "\n• ")
      .replace(/<\/\s*(p|div|h[1-6]|ul|ol|li|section)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return null;
  return text.length > 20_000 ? `${text.slice(0, 20_000)}…` : text;
}
