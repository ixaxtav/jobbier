import { NextResponse } from "next/server";
import { getEvent } from "@/data/job-details";
import { getCurrentUser } from "@/lib/auth/session";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (s: string) => s.replace(/\r\n?/g, "\n").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** RFC 5545: lines over 75 octets continue on the next line after a space. */
function fold(line: string) {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let current = "";
  for (const char of line) {
    if (bytes.encode(current + char).length > (out.length ? 74 : 75)) {
      out.push(current);
      current = char;
    } else current += char;
  }
  out.push(current);
  return out.join("\r\n ");
}

/** A single-event calendar file, so interviews land in whatever calendar you already use. */
export async function GET(_: Request, ctx: RouteContext<"/api/events/[id]/ics">) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in to download", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const row = await getEvent(user.id, id);
  if (!row) return new NextResponse("Not found", { status: 404 });

  const { event, company, jobTitle } = row;
  const end = new Date(event.startsAt.getTime() + event.durationMinutes * 60_000);
  const description = [`${jobTitle} at ${company}`, event.notes].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jobbier//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}@jobbier`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(`${event.title} · ${company}`)}`,
    `DESCRIPTION:${escape(description)}`,
    event.location ? `LOCATION:${escape(event.location)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  const slug = `${company}-${event.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return new NextResponse(lines.map((l) => fold(l!)).join("\r\n"), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${slug || "event"}.ics"`,
    },
  });
}
