import { AppShell } from "@/components/shell/app-shell";
import { countPendingLeads } from "@/data/leads";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const pendingLeads = await countPendingLeads(user.id);
  return (
    <AppShell user={{ name: user.name, email: user.email }} pendingLeads={pendingLeads}>
      {children}
    </AppShell>
  );
}
