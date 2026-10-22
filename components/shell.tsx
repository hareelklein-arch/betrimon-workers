import Link from "next/link";
import { logoutAction } from "@/lib/actions";
import { unreadCount } from "@/lib/notifications";
import { ROLE_LABELS } from "@/lib/format";
import { PushToggle } from "@/components/push-toggle";

type NavItem = { href: string; label: string };

export async function AppShell({
  user,
  nav,
  children,
}: {
  user: { id: string; name: string; role: string };
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const unread = await unreadCount(user.id);
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
            {unread > 0 ? (
              <span className="absolute -top-1 -left-1 min-w-5 rounded-full bg-[var(--danger)] px-1 text-center text-xs text-white">
                {unread}
              </span>
            ) : null}
          </Link>
          <form action={logoutAction}>
            <button className="btn btn-secondary" type="submit">
              יציאה
            </button>
          </form>
        </div>
      </header>
      <PushToggle />
      <main>{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--line)] bg-[var(--card)]/95 backdrop-blur">
        <div
          className="mx-auto grid max-w-5xl gap-1 px-2 py-2"
          style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
        >
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="btn btn-secondary px-2 text-xs sm:text-sm">
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
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
    taken: ["אושר", "badge-ok"],
    expired: ["פג תוקף", "badge"],
    scheduled: ["משובץ", "badge-ok"],
    swapped: ["הוחלף", "badge-wait"],
    cancelled: ["בוטל", "badge-bad"],
  };
  const [label, className] = labels[status] || [status, "badge"];
  return <span className={`badge ${className}`}>{label}</span>;
}
