import { Download } from "lucide-react";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import {
  DeleteAccountForm,
  InviteCard,
  PasswordForm,
  PreferencesForm,
  ProfileForm,
  ThemePicker,
} from "@/components/settings/settings-forms";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Job preferences" },
  { id: "invite", label: "Invite friends" },
  { id: "appearance", label: "Appearance" },
  { id: "data", label: "Your data" },
  { id: "password", label: "Password" },
  { id: "delete", label: "Delete account" },
];

export default async function SettingsPage() {
  const user = await requireUser();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const inviteCode = process.env.INVITE_CODE;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>
      </header>
      <div className="grid gap-10 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-8 flex flex-col gap-0.5 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-sm px-2.5 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex max-w-2xl flex-col">
          <Section id="profile" title="Profile">
            <ProfileForm name={user.name} timeZone={user.timeZone} />
            <p className="mt-4 text-sm text-ink-3">Signed in as {user.email}.</p>
          </Section>
          <Section id="preferences" title="Job preferences" description="Optional. Jobbier uses these to flag jobs that don't fit and to decide when an application has gone quiet.">
            <PreferencesForm payFloor={user.payFloor} payFloorPeriod={user.payFloorPeriod} workModes={user.workModes} staleAfterDays={user.staleAfterDays} />
          </Section>
          <Section id="invite" title="Invite friends" description="Jobbier is better with a few friends: you can send each other job leads.">
            {inviteCode ? <InviteCard code={inviteCode} url={`${origin}/sign-up`} /> : <p className="text-ink-2">Sign-ups are turned off (no invite code is set).</p>}
          </Section>
          <Section id="appearance" title="Appearance">
            <ThemePicker initial={theme} />
          </Section>
          <Section id="data" title="Your data" description="Download everything you've put into Jobbier, any time.">
            <div className="flex flex-wrap gap-2">
              <a href="/api/export" className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium hover:border-ink-3 hover:bg-surface-2">
                <Download aria-hidden className="size-4" /> Everything (JSON)
              </a>
              <a href="/api/export?format=csv" className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium hover:border-ink-3 hover:bg-surface-2">
                <Download aria-hidden className="size-4" /> Jobs spreadsheet (CSV)
              </a>
            </div>
          </Section>
          <Section id="password" title="Password">
            <PasswordForm />
          </Section>
          <Section id="delete" title="Delete account" danger>
            <DeleteAccountForm email={user.email} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, description, danger, children }: { id: string; title: string; description?: string; danger?: boolean; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-line py-8 first:border-t-0 first:pt-0">
      <h2 id={`${id}-title`} className={danger ? "text-lg font-semibold text-danger" : "text-lg font-semibold"}>
        {title}
      </h2>
      {description ? <p className="mt-1 mb-5 text-sm text-ink-2">{description}</p> : <div className="mb-5" />}
      {children}
    </section>
  );
}
