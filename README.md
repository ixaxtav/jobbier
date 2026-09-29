# Jobbier

A free, private job-search companion for you and a few friends. Every job you're
looking at sits on one line — **Saved → Applied → Interviewing → Offer** — and
the Today page tells you what needs a nudge.

Live: https://jobbier.vercel.app (Vercel project `jobbier`, team "Ixax's Projects").

Built as a new product using JobCore (`../api`, `../employer-web-client`,
`../jobcore-mobile`, …) as research material. See [`docs/PLAN.md`](docs/PLAN.md)
for what was kept, replaced and removed, and why.

## What's in it

- **Today** — the pipeline as one line, what needs you (overdue follow-ups, quiet
  applications, offers waiting), the next two weeks of interviews, weekly pace.
- **Jobs** — board (drag between stages, or use each card's menu) and list
  (search, stage filter, sort). Add a job by pasting its link: title, company,
  location and pay are read from the posting (JSON-LD / Open Graph).
- **Job page** — stage track (tap a stop, with undo), one next step with a due
  date, schedule (interviews, calls, deadlines, `.ics` export), a log of notes and
  stage changes, people, and the files you sent.
- **Leads** — send a job to a friend; they save it to their jobs or dismiss it.
- **Files** — résumés and cover letters in a private Blob store.
- **Settings** — pay floor and work setup (flags jobs that don't fit), invite
  code, theme, JSON/CSV export, password, delete account.

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind v4 ·
Postgres (Neon) with Drizzle ORM · Vercel Blob (private) · Radix primitives ·
dnd-kit · zod · Vitest.

```
src/
  app/            routes: (auth) sign-in/up, (app) today, jobs, leads, files, settings; api/ routes
  actions/        Server Actions — validate input, call the data layer, revalidate
  data/           the only code that queries the database; everything is scoped by userId
  db/             Drizzle schema + client
  lib/domain/     pure product rules (stages, attention, stats, fit) — unit tested
  lib/import/     URL import: parser + SSRF-guarded fetcher
  components/     UI; components/ui holds the primitives
drizzle/          SQL migrations (applied on production deploys)
scripts/          migrate, seed (local only), reset-password
tests/            unit tests, DB integration tests, opt-in live import test
```

## Local development

```bash
npm install
cp .env.example .env.local          # set DATABASE_URL and INVITE_CODE
createdb jobbier_dev && npm run db:migrate
npm run dev                          # http://localhost:3000
npm run db:seed -- you@example.com   # optional: sample jobs + a friend with leads
```

Without `BLOB_READ_WRITE_TOKEN`, uploaded files are stored in `./.uploads`.

## Checks

```bash
npm run typecheck && npm run lint && npm test   # unit tests
createdb jobbier_test && npm run test:db       # data layer against Postgres
LIVE=1 npx vitest run tests/live-import.test.ts # hits real job boards
npm run build
```

## Environment

| Variable | Where | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Neon integration | Pooled URL used by the app |
| `DATABASE_URL_UNPOOLED` | Neon integration | Direct URL used for migrations |
| `INVITE_CODE` | set manually (sensitive) | Required to sign up; shown to signed-in users in Settings |
| `BLOB_READ_WRITE_TOKEN` | Blob store `jobbier-crew` | Private store; production only |

## Deploying

`vercel deploy --prod` from this folder (it's linked to the `jobbier` project).
The `vercel-build` script runs `scripts/migrate.mjs` first; migrations are skipped
on preview deploys so a branch can't change the production schema. Note that
preview deploys share the production database — keep schema changes additive.

After changing `src/db/schema.ts`: `npm run db:generate`, commit the new file in
`drizzle/`, deploy.

## Forgotten passwords

Jobbier sends no email. Reset a friend's password from your machine:

```bash
vercel env pull .env.production.local --environment production
DATABASE_URL="$(grep ^DATABASE_URL_UNPOOLED .env.production.local | cut -d= -f2- | tr -d '"')" \
  npm run user:reset-password -- friend@example.com
rm .env.production.local
```

It prints a one-time password and signs them out everywhere; they change it in Settings.
