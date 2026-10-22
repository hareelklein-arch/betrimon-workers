import { prisma } from "@/lib/db";
import { markNotificationsReadAction } from "@/lib/actions";
import { EmptyState, PageTitle } from "@/components/shell";
import { formatDateTime } from "@/lib/format";

export async function NotificationsView({ userId }: { userId: string }) {
  const items = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      <PageTitle title="התראות" subtitle="בקשת החלפה מגיעה לכולם. אישור החלפה מגיע רק למי שביקש." />
      <form action={markNotificationsReadAction} className="mb-4">
        <button className="btn btn-secondary">סימון הכול כנקרא</button>
      </form>
      {items.length === 0 ? (
        <EmptyState text="אין התראות." />
      ) : (
        <div className="grid gap-2">
          {items.map((item) => (
            <article key={item.id} className={`card p-4 ${item.readAt ? "" : "border-[var(--primary)]"}`}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-extrabold">{item.title}</h3>
                <span className="text-xs text-[var(--muted)]">{formatDateTime(item.createdAt)}</span>
              </div>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
