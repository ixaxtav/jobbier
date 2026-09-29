"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, FileText, Inbox, LogOut, Plus, Settings, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { signOut } from "@/actions/auth";
import { Wordmark, LogoMark } from "@/components/logo";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { AddJobProvider, useAddJob } from "@/components/jobs/add-job";

type NavItem = { href: string; label: string; icon: typeof Sun; badge?: number };

export function AppShell({
  user,
  pendingLeads,
  children,
}: {
  user: { name: string; email: string };
  pendingLeads: number;
  children: ReactNode;
}) {
  const nav: NavItem[] = [
    { href: "/today", label: "Today", icon: Sun },
    { href: "/jobs", label: "Jobs", icon: Briefcase },
    { href: "/leads", label: "Leads", icon: Inbox, badge: pendingLeads },
    { href: "/files", label: "Files", icon: FileText },
  ];

  return (
    <AddJobProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-pop">
        Skip to content
      </a>
      <div className="md:grid md:min-h-dvh md:grid-cols-[76px_1fr] lg:grid-cols-[236px_1fr]">
        <Rail nav={nav} user={user} />
        <div className="flex min-w-0 flex-col">
          <TopBar user={user} />
          <main id="main" className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+96px)] sm:px-6 md:px-8 md:pt-8 md:pb-16">
            {children}
          </main>
        </div>
      </div>
      <BottomNav nav={nav} />
    </AddJobProvider>
  );
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

function Rail({ nav, user }: { nav: NavItem[]; user: { name: string; email: string } }) {
  const isActive = useIsActive();
  const addJob = useAddJob();
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface/60 px-3 py-5 md:flex lg:px-4">
      <Link href="/today" className="mb-6 flex items-center px-1.5 max-lg:justify-center" aria-label="Jobbier home">
        <Wordmark className="max-lg:hidden" />
        <LogoMark className="lg:hidden" />
      </Link>

      <button
        type="button"
        onClick={() => addJob.open()}
        className="mb-5 flex h-10 items-center gap-2 rounded-md bg-highlight px-3 text-sm font-semibold text-highlight-ink shadow-[inset_0_-1.5px_0_rgb(0_0_0/0.12)] hover:brightness-[0.97] max-lg:justify-center max-lg:px-0"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        <span className="max-lg:sr-only">Add job</span>
        <kbd className="ml-auto rounded-[4px] bg-black/10 px-1.5 text-2xs font-medium max-lg:hidden">N</kbd>
      </button>

      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5">
        <NavLink item={{ href: "/settings", label: "Settings", icon: Settings }} active={isActive("/settings")} />
        <UserMenu user={user} align="start">
          <button
            type="button"
            className="mt-2 flex h-11 w-full items-center gap-2.5 rounded-md px-1.5 text-left hover:bg-surface-2 max-lg:justify-center"
          >
            <Avatar name={user.name} />
            <span className="min-w-0 flex-1 max-lg:hidden">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-ink-3">{user.email}</span>
            </span>
          </button>
        </UserMenu>
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-md px-2.5 text-sm font-medium transition-colors max-lg:justify-center",
        active ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", active ? "text-ink" : "text-ink-3 group-hover:text-ink-2")} strokeWidth={active ? 2.25 : 2} />
      <span className="max-lg:sr-only">{item.label}</span>
      {item.badge ? (
        <span className="ml-auto rounded-full bg-highlight px-1.5 text-2xs font-semibold text-highlight-ink tabular max-lg:absolute max-lg:top-1 max-lg:right-1.5 max-lg:ml-0">
          {item.badge}
          <span className="sr-only"> new</span>
        </span>
      ) : null}
    </Link>
  );
}

function TopBar({ user }: { user: { name: string; email: string } }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
      <Link href="/today" aria-label="Jobbier home">
        <Wordmark />
      </Link>
      <UserMenu user={user}>
        <button type="button" aria-label="Account menu" className="rounded-full">
          <Avatar name={user.name} />
        </button>
      </UserMenu>
    </header>
  );
}

function BottomNav({ nav }: { nav: NavItem[] }) {
  const isActive = useIsActive();
  const addJob = useAddJob();
  const [first, second, ...rest] = nav;
  const item = (n: NavItem) => {
    const Icon = n.icon;
    const active = isActive(n.href);
    return (
      <Link
        key={n.href}
        href={n.href}
        aria-current={active ? "page" : undefined}
        className={cn("relative flex flex-1 flex-col items-center justify-center gap-0.5 text-2xs font-medium", active ? "text-ink" : "text-ink-3")}
      >
        <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.9} />
        {n.label}
        {n.badge ? (
          <span className="absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-highlight px-1 text-center text-[10px] leading-4 font-semibold text-highlight-ink">
            {n.badge}
            <span className="sr-only"> new</span>
          </span>
        ) : null}
      </Link>
    );
  };
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(env(safe-area-inset-bottom)+64px)] items-stretch border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      {item(first)}
      {item(second)}
      <div className="flex flex-1 items-center justify-center">
        <button
          type="button"
          onClick={() => addJob.open()}
          aria-label="Add job"
          className="flex size-12 items-center justify-center rounded-full bg-highlight text-highlight-ink shadow-[0_4px_14px_-4px_rgb(0_0_0/0.35)] active:scale-95"
        >
          <Plus className="size-6" strokeWidth={2.5} />
        </button>
      </div>
      {rest.map(item)}
    </nav>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-bg", className)}
    >
      {initials(name)}
    </span>
  );
}

function UserMenu({ user, children, align = "end" }: { user: { name: string; email: string }; children: ReactNode; align?: "start" | "end" }) {
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent align={align}>
        <MenuLabel>{user.email}</MenuLabel>
        <MenuItem asChild>
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<LogOut />} onSelect={() => void signOut()}>
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
