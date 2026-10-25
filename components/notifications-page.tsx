import { prisma } from "@/lib/db";
import { MarkAllReadButton } from "@/components/forms";
import { PushToggle } from "@/components/push-toggle";
import { EmptyState, PageTitle } from "@/components/shell";
import { afterResponse } from "@/lib/background";
import { formatDateTime } from "@/lib/format";
import { dismissWorkerPendingNotifications, notificationCta } from "@/lib/notifications";

export async function NotificationsView({ userId }: { userId: string }) {
  afterResponse(() => dismissWorkerPendingNotifications());
  const items = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      <PageTitle title="התראות" subtitle="לוחצים על התראה כדי לעבור ישר לדף הרלוונטי." />
      <PushToggle />
      <div className="mb-4">
        <MarkAllReadButton />
      </div>
      {items.length === 0 ? (
        <EmptyState text="אין התראות." />
      ) : (
        <div className="grid gap-2">
          {items.map((item) => (
            <a
              key={item.id}
              href={`/n/${item.id}`}
              className={`card block p-4 ${item.readAt ? "" : "border-[var(--primary)]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-extrabold">{item.title}</h3>
                <span className="text-xs text-[var(--muted)]">{formatDateTime(item.createdAt)}</span>
              </div>
              <p>{item.body}</p>
              <p className="mt-2 text-sm font-bold text-[var(--primary)]">{notificationCta(item.type)}</p>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
