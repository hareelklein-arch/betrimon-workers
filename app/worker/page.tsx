import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageTitle, StatusBadge } from "@/components/shell";
import { ActionButton } from "@/components/forms";
import { requestSwapAction } from "@/lib/actions";
import { endOfDay, startOfDay } from "@/lib/format";
import { canRequestSwap, formatShiftHours, formatShiftWhen, shiftDateKey } from "@/lib/shift";

export default async function WorkerHomePage() {
  const user = await requireUser();
  const from = startOfDay(new Date());
  from.setDate(from.getDate() - 1);
  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 7);

  const shifts = await prisma.shift.findMany({
    where: {
      userId: user.id,
      status: { not: "cancelled" },
    },
    include: { site: true, jobType: true, swapRequests: true },
    orderBy: [{ workDate: "asc" }, { startsAt: "asc" }],
  });

  const upcoming = shifts.filter((shift) => {
    const day = shift.workDate ?? shift.startsAt;
    if (!day) return false;
    return day >= from && day <= endOfDay(weekAhead);
  });

  return (
    <>
      <PageTitle title="השבוע שלי" subtitle="המנהל משבץ תאריך. את השעות מתאמים בצ'אט עם מי שעובד באותו יום, ומדווחים אחרי העבודה." />
      {upcoming.length === 0 ? (
        <EmptyState text="אין משמרות קרובות." />
      ) : (
        <div className="grid gap-3">
          {upcoming.map((shift) => {
            const openSwap = shift.swapRequests.some((request) => request.status === "open");
            const chatHref = `/worker/chat/${shiftDateKey(shift)}`;
            return (
              <article key={shift.id} className="card p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-extrabold">{shift.jobType.name}</h3>
                    <p className="text-[var(--muted)]">{shift.site.name}</p>
                  </div>
                  <StatusBadge status={shift.status} />
                </div>
                <p>{formatShiftWhen(shift)}</p>
                <p className="text-sm text-[var(--muted)]">{formatShiftHours(shift)}</p>
                {shift.notes ? <p className="mt-2 text-sm">{shift.notes}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={chatHref} className="btn">
                    צ'אט של היום
                  </Link>
                  {canRequestSwap(shift) && !openSwap ? (
                    <ActionButton action={requestSwapAction} label="בקשת החלפה" className="btn btn-secondary" hidden={{ shiftId: shift.id }} />
                  ) : null}
                </div>
                {openSwap ? <p className="mt-2 text-sm text-[var(--accent)]">בקשת החלפה פתוחה</p> : null}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
