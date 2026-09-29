import type { PayPeriod, WorkMode } from "@/db/schema";

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
};

/** "Miami, FL, Hybrid" — but never "Remote, Remote". */
export function formatWhere(location: string | null | undefined, workMode: WorkMode | null | undefined): string | null {
  const mode = workMode ? WORK_MODE_LABEL[workMode] : null;
  if (!location) return mode;
  if (!mode || location.toLowerCase().includes(mode.toLowerCase()) || (workMode === "onsite" && /on[- ]?site/i.test(location))) return location;
  return `${location}, ${mode}`;
}

export const PAY_PERIOD_LABEL: Record<PayPeriod, string> = { year: "/ yr", hour: "/ hr" };

function money(amount: number, currency: string, compact: boolean) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/** "$120K–$150K / yr", "$28 / hr", "From $90K / yr". Null when there's no pay info. */
export function formatPay(
  min: number | null | undefined,
  max: number | null | undefined,
  period: PayPeriod,
  currency = "USD",
): string | null {
  const compact = period === "year";
  const suffix = PAY_PERIOD_LABEL[period];
  if (min != null && max != null && min !== max) return `${money(min, currency, compact)}–${money(max, currency, compact)} ${suffix}`;
  if (min != null || max != null) {
    const value = (min ?? max)!;
    const prefix = min != null && max == null ? "From " : max != null && min == null ? "Up to " : "";
    return `${prefix}${money(value, currency, compact)} ${suffix}`;
  }
  return null;
}

/** Annualised midpoint, used to compare a job against a pay floor. 2,080 working hours a year. */
export function annualPay(min: number | null, max: number | null, period: PayPeriod): number | null {
  const top = max ?? min;
  if (top == null) return null;
  return period === "hour" ? top * 2080 : top;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function pluralize(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Host without "www." for display, e.g. "boards.greenhouse.io". */
export function displayHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
