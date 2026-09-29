# Jobbier — implementation plan

Jobbier is a free, private job-search companion for a handful of friends. It is
**not** a port of JobCore. JobCore (in `../api`, `../employer-web-client`,
`../jobcore-mobile`, …) is kept untouched as research material.

## What JobCore was

A two-sided hospitality staffing marketplace: employers posted hourly shifts,
the backend matched and invited workers, workers applied, clocked in with GPS,
employers approved timesheets, ran payroll with federal withholding, paid via
Plaid/Stripe, and both sides rated each other. Employers paid a subscription
($49.95–$149.95/mo). Django 2.2 API + React 16/Flux employer SPA + React Native
0.59 talent app + two marketing sites. Backend is offline (Heroku app gone).

The talent side is the part that maps to a job seeker. Its useful ideas:
a status-driven pipeline (invite → applied → accepted/rejected → expired),
"next shift" focus on the dashboard, preferences (pay floor, distance, roles),
resume upload, ratings, and invitations pushed to you by someone else.

## Feature decisions

| JobCore feature | Decision | Jobbier |
| --- | --- | --- |
| Shift invites / applications with statuses | **Replaced** | A personal pipeline: Saved → Applied → Interviewing → Offer → Closed (outcome: hired, rejected, declined, withdrew, ghosted). |
| Employer "invite talent to shift" | **Replaced** | *Leads*: send a job you found to a friend; they save or dismiss it. The one social feature. |
| Dashboard with 5 status boxes + day calendar | **Replaced** | *Today*: next event, what needs attention, this week's numbers, the pipeline line. |
| Shift expiry cron (EXPIRED) | **Replaced** | Stale detection computed on read: "applied 16 days ago, no reply → follow up or mark ghosted". No cron. |
| Calendar (day/week/month, drag to reschedule) | **Simplified** | Events (interviews, calls, deadlines) on each job + an agenda on Today + .ics download. No calendar grid. |
| Talent preferences (min rate, distance, positions) | **Simplified** | Optional preferences (target roles, pay floor, work mode) that flag jobs below your floor. |
| Resume upload, I-9 documents | **Improved / split** | *Files*: resumes and cover letters in a private store; attach the version you sent to each job. I-9 dropped. |
| Ratings (employer ↔ talent) | **Replaced** | Excitement (1–5) per job — your own signal for prioritising. |
| Venues + Google Places | **Removed** | Location is a text field + work mode (remote / hybrid / on-site). |
| Favorite lists, badges, talent search | **Removed** | Marketplace plumbing. |
| Clock-in/out, GPS, work mode | **Removed** | Not relevant to a job search. |
| Payroll, deductions, taxes, W-4, I-9, Plaid, Stripe, bank accounts | **Removed** | Compliance/payments plumbing. |
| Subscriptions, plans, pricing pages, free trial | **Removed** | Jobbier is free. No monetisation concepts anywhere. |
| Company users & roles | **Removed** | Each person owns their own data. |
| Email/SMS verification, push, forced app updates | **Removed** | Invite-code sign-up; no email provider needed. |
| 6-step mandatory onboarding, joyride tour | **Replaced** | Zero mandatory steps. Strong empty states + a 3-item "getting started" on Today. |
| Public job board | **Removed** | Out of scope; jobs come from anywhere via URL import. |
| — (new) | **Added** | Paste a job URL → title/company/location/pay pre-filled from JSON-LD / Open Graph. |
| — (new) | **Added** | Activity log per job (stage changes + your notes) and people (recruiter, hiring manager). |
| — (new) | **Added** | Export everything (JSON, CSV). Your data is yours. |

## Architecture

- **Next.js 16 App Router** on Vercel (Hobby). Server Components read, Server
  Actions write. No separate API service.
- **Postgres** (Neon via Vercel Marketplace in production, local Postgres in
  dev) with **Drizzle ORM** + SQL migrations in `drizzle/`, applied on deploy.
- **Auth**: email + password (Node `scrypt`), opaque session tokens stored
  hashed in Postgres, httpOnly cookie. Sign-up requires `INVITE_CODE`.
  (JobCore used 9,999-day JWTs and had no ownership checks.)
- **Ownership** enforced in one data-access layer: every query is scoped by
  `userId`. No route touches the DB directly.
- **Files**: Vercel Blob *private* store (`jobbier-crew`), streamed through an
  authenticated route. Local-disk fallback when no token (dev/tests).
- **Validation**: zod schemas shared by forms and actions.
- **UI**: Tailwind v4 tokens, Radix primitives for dialogs/menus, dnd-kit for
  the board, sonner toasts, lucide icons.
- **Tests**: Vitest for domain logic (stages, attention rules, stats, import
  parsing, formatting) and the data layer against a test database.

## Design system

- **Motif — the line.** Stages are stops on a transit line. The Today page
  opens with your whole search drawn as one line with counts; every job carries
  a mini line. Stage colours are used only for stages.
- **Highlighter** (`#FFD84D`) marks what needs you today — the only loud colour.
- **Type**: Bricolage Grotesque (one family; optical sizes do the work).
- **Surfaces**: few. Lists and rows over card grids; hierarchy via type and
  spacing, borders only where they separate information.
- **Navigation**: left rail on desktop, bottom bar on mobile; global "Add job".

## Build order

1. Foundation: config, schema, migrations, auth, data layer, tests.
2. Shell: layout, navigation, tokens, primitives.
3. Flows: add job (URL import) → pipeline (board/list) → job detail (stage,
   log, events, people, files) → Today → Leads → Files → Settings/export.
4. First-run review, mobile pass, a11y pass, bugs.
5. Build/lint/typecheck/tests → provision DB → deploy to new `jobbier` project.
