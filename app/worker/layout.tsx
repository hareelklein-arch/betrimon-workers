import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/shell";
import { errorText, isNextControlFlow } from "@/lib/errors";

const nav = [
  { href: "/worker", label: "שלי" },
  { href: "/worker/history", label: "סיימתי" },
  { href: "/worker/chat", label: "צ'אט" },
  { href: "/worker/swaps", label: "החלפות" },
  { href: "/worker/stats", label: "שכר" },
];

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  try {
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
