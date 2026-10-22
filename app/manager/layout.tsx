import { requireManager } from "@/lib/auth";
import { AppShell } from "@/components/shell";

const nav = [
  { href: "/manager", label: "שיבוץ" },
  { href: "/manager/approvals", label: "אישורים" },
  { href: "/manager/swaps", label: "החלפות" },
  { href: "/manager/payroll", label: "שכר" },
  { href: "/manager/people", label: "ניהול" },
];

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireManager();
  return <AppShell user={user} nav={nav}>{children}</AppShell>;
}
