import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { LogoutButton } from "@/components/logout-button";
import { ROLE_LABELS } from "@/lib/format";
import { PushSetup } from "@/components/push-setup";
import { SetupNudge } from "@/components/setup-nudge";

type NavItem = { href: string; label: string };

export function AppShell({
  user,
  nav,
  children,
  bell,
  banner,
}: {
  user: { id: string; name: string; role: string };
  nav: NavItem[];
  children: React.ReactNode;
  bell?: React.ReactNode;
  banner?: React.ReactNode;
}) {
  const home = user.role === "manager" ? "/manager" : "/worker";
  const notificationsHref = user.role === "manager" ? "/manager/notifications" : "/worker/notifications";

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pb-32 pt-4">
      <header className="card mb-5 flex items-center justify-between gap-3 px-4 py-3">
        <Link href={home} className="min-w-0">
          <p className="text-xs text-[var(--muted)]">בית רימון</p>
          <h1 className="truncate text-lg font-extrabold">שלום, {user.name}</h1>
          <p className="text-sm text-[var(--muted)]">{ROLE_LABELS[user.role] || user.role}</p>
        </Link>
        <div className="flex items-center gap-2">
          <Link href={notificationsHref} className="btn btn-secondary relative px-3">
            פעמון
            {bell}
          </Link>
          <LogoutButton />
        </div>
      </header>
      <PushSetup />
      <SetupNudge />
      {banner}
      <main>{children}</main>
      <BottomNav items={nav} />
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-2xl font-black">{title}</h2>
      {subtitle ? <p className="text-[var(--muted)]">{subtitle}</p> : null}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="card px-5 py-8 text-center text-[var(--muted)]">{text}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, [string, string]> = {
    submitted: ["ממתין לאישור", "badge-wait"],
    approved: ["אושר", "badge-ok"],
    rejected: ["נדחה", "badge-bad"],
    open: ["פתוח", "badge-wait"],
    taken: ["נלקחה", "badge-ok"],
    expired: ["פג תוקף", "badge"],
    scheduled: ["משובץ", "badge-ok"],
    swapped: ["הוחלף", "badge-wait"],
    cancelled: ["בוטל", "badge-bad"],
  };
  const [label, className] = labels[status] || [status, "badge"];
  return <span className={`badge ${className}`}>{label}</span>;
}
