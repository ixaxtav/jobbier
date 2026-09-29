/**
 * Date helpers that are explicit about time zones. The server renders in UTC,
 * so anything a person reads ("today", "Tuesday at 2 PM") is formatted in the
 * user's saved time zone.
 */

const DAY_MS = 86_400_000;

/** Calendar date (YYYY-MM-DD) for an instant, as seen in `timeZone`. */
export function dayKey(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Whole days between two calendar dates (b - a). */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

export function addDaysToKey(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Days elapsed since `date`, counted in calendar days in `timeZone`. */
export function daysSince(date: Date, now: Date, timeZone: string): number {
  return daysBetweenKeys(dayKey(date, timeZone), dayKey(now, timeZone));
}

/** Monday of the week containing `key`. */
export function weekStartKey(key: string): string {
  const weekday = new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDaysToKey(key, -((weekday + 6) % 7));
}

export function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
}

/** "Today", "Tomorrow", "Yesterday", weekday within a week, else "Mar 4" (+ year if not this year). */
export function formatDayLabel(key: string, todayKey: string): string {
  const diff = daysBetweenKeys(todayKey, key);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const date = new Date(`${key}T12:00:00Z`);
  if (diff > 1 && diff < 7) return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(date);
  const sameYear = key.slice(0, 4) === todayKey.slice(0, 4);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** For mid-sentence use: "due tomorrow", "due Friday", "due Nov 12". */
export function formatDayInline(key: string, todayKey: string): string {
  const label = formatDayLabel(key, todayKey);
  return ["Today", "Tomorrow", "Yesterday"].includes(label) ? label.toLowerCase() : label;
}

export function formatDateTime(date: Date, timeZone: string, now = new Date()) {
  return `${formatDayLabel(dayKey(date, timeZone), dayKey(now, timeZone))} at ${formatTime(date, timeZone)}`;
}

/** "just now", "5 minutes ago", "3 days ago", "in 2 hours". */
export function formatRelative(date: Date, now = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < DAY_MS / 1000) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 30 * 86400) return rtf.format(Math.round(seconds / 86400), "day");
  if (abs < 365 * 86400) return rtf.format(Math.round(seconds / (30 * 86400)), "month");
  return rtf.format(Math.round(seconds / (365 * 86400)), "year");
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a `datetime-local` value ("2026-10-02T14:30") as wall-clock time in
 * `timeZone` and return the UTC instant.
 */
export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Find the zone's offset at that moment, then correct once more for DST edges.
  let guess = asUtc - offsetMs(new Date(asUtc), timeZone);
  guess = asUtc - offsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

/** Inverse of `zonedLocalToUtc`, for pre-filling `datetime-local` inputs. */
export function utcToZonedLocal(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}
