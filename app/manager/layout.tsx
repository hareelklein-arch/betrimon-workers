import { requireManager } from "@/lib/auth";
import { AppShell } from "@/components/shell";
import { prisma } from "@/lib/db";
import { errorText, isNextControlFlow } from "@/lib/errors";

const nav = [
  { href: "/manager", label: "שיבוץ" },
  { href: "/manager/approvals", label: "אישורים" },
  { href: "/manager/payroll", label: "שכר" },
  { href: "/manager/people", label: "ניהול" },
];

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  try {
    const user = await requireManager();
    let pendingWorkers = 0;
    try {
      pendingWorkers = await prisma.user.count({ where: { pendingApproval: true } });
    } catch (error) {
      console.error("pendingWorkers", error);
    }
    return (
      <AppShell user={user} nav={nav} pendingWorkers={pendingWorkers}>
        {children}
      </AppShell>
    );
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return (
      <div className="mx-auto max-w-lg p-4">
        <div className="card p-6">
          <h1 className="text-2xl font-black">שגיאה אחרי הכניסה</h1>
          <p className="mt-3 whitespace-pre-wrap text-sm">{errorText(error)}</p>
        </div>
      </div>
    );
  }
}
