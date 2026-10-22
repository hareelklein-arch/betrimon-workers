import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/shell";

const nav = [
  { href: "/worker", label: "שלי" },
  { href: "/worker/report", label: "דיווח" },
  { href: "/worker/chat", label: "צ'אט" },
  { href: "/worker/swaps", label: "החלפות" },
  { href: "/worker/stats", label: "שכר" },
];

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role === "manager") {
    return (
      <AppShell
        user={user}
        nav={[
          { href: "/manager", label: "לוח" },
          { href: "/worker", label: "מבט עובד" },
          ...nav.slice(1),
        ]}
      >
        {children}
      </AppShell>
    );
  }

  return <AppShell user={user} nav={nav}>{children}</AppShell>;
}
