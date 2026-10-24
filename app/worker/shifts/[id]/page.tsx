import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageTitle, StatusBadge } from "@/components/shell";
import { ActionButton } from "@/components/forms";
import { requestSwapAction } from "@/lib/actions";
import { endOfDay, formatDate, formatTime, startOfDay } from "@/lib/format";
import { parseNotificationShiftId } from "@/lib/notifications";
import { hoursBetween } from "@/lib/payroll";
import { dateWorkIsFinished } from "@/lib/chat";
import { canRequestSwap, formatShiftDate, formatShiftWhen, hasShiftTimes, shiftDateKey, shiftDay, shiftWasReported, uniqueAssignments } from "@/lib/shift";

export default async function WorkerShiftDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      site: true,
      jobType: true,
      user: true,
      createdBy: true,
      swapRequests: true,
      timeEntries: { select: { status: true } },
    },
  });

  if (!shift || (user.role !== "manager" && shift.userId !== user.id)) {
    notFound();
  }

  if (user.id === shift.userId) {
    const unread = await prisma.notification.findMany({
      where: { userId: user.id, type: "shift_assigned", readAt: null },
      select: { id: true, meta: true },
    });
    const ids = unread
      .filter((item) => {
        const parsed = parseNotificationShiftId(item.meta);
        return parsed === shift.id || !parsed;
      })
      .map((item) => item.id);
    if (ids.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: ids } },
        data: { readAt: new Date() },
      });
    }
  }

  const day = shiftDay(shift);
  const coworkers = await prisma.shift.findMany({
    where: {
      id: { not: shift.id },
      status: { not: "cancelled" },
      OR: [{ workDate: { gte: startOfDay(day), lte: endOfDay(day) } }, { startsAt: { gte: startOfDay(day), lte: endOfDay(day) } }],
    },
    include: { user: true, site: true, jobType: true, timeEntries: { select: { status: true } } },
    orderBy: { startsAt: "asc" },
  });
  const uniqueCoworkers = uniqueAssignments(coworkers);

  const reported = shiftWasReported(shift.timeEntries);
  const chatClosed = dateWorkIsFinished([shift, ...coworkers]);
  const openSwap = shift.swapRequests.some((request) => request.status === "open");
  const chatHref = `/worker/chat/${shiftDateKey(shift)}`;
  const reportHref = `/worker/report?shiftId=${shift.id}`;

  return (
    <>
      <Link href={reported ? "/worker/history" : "/worker"} className="mb-3 inline-block text-sm font-bold text-[var(--primary)]">
        {reported ? "חזרה לעבודות שסיימתי" : "חזרה לשיבוצים"}
      </Link>
      <PageTitle title="פרטי השיבוץ" subtitle="כאן רואים מתי, איפה, ועם מי עובדים באותו יום." />
      <article className="card grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-black">{shift.jobType.name}</h3>
            <p className="text-[var(--muted)]">{shift.site.name}</p>
            {shift.trainee ? <p className="mt-1 font-bold text-[var(--accent)]">שובצת כמתלמד/ת</p> : null}
          </div>
          <StatusBadge status={shift.status} />
        </div>
        <p className="text-lg font-bold">{formatShiftDate(shift)}</p>
        <p>
          {hasShiftTimes(shift) ? (
            <span>
              {formatTime(shift.startsAt)} – {formatTime(shift.endsAt)}
            </span>
          ) : (
            "שעות בתיאום בצ'אט"
          )}
        </p>
        <p className="text-[var(--muted)]">
          {hasShiftTimes(shift) ? (
            <>
              שעות <span dir="ltr">{hoursBetween(shift.startsAt, shift.endsAt).toLocaleString("he-IL", { maximumFractionDigits: 2 })}</span>
            </>
          ) : (
            "שעות עדיין לא נקבעו"
          )}
        </p>
        {shift.notes ? <p>{shift.notes}</p> : null}
        <p className="text-sm text-[var(--muted)]">שובצת על ידי {shift.createdBy.name}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {chatClosed ? (
            <p className="self-center text-sm font-bold text-[var(--muted)]">הצ'אט נמחק כי העבודה הסתיימה</p>
          ) : (
            <Link href={chatHref} className="btn">
              צ'אט של היום
            </Link>
          )}
          {reported ? (
            <p className="self-center text-sm font-bold text-[var(--ok)]">השעות כבר דווחו</p>
          ) : (
            <Link href={reportHref} className="btn btn-secondary">
              דיווח שעות
            </Link>
          )}
          {user.id === shift.userId && !reported && shift.status !== "cancelled" && canRequestSwap(shift) && !openSwap ? (
            <ActionButton action={requestSwapAction} label="בקשת החלפה" className="btn btn-secondary" hidden={{ shiftId: shift.id }} />
          ) : null}
        </div>
        {openSwap ? <p className="text-sm text-[var(--accent)]">בקשת החלפה פתוחה</p> : null}
      </article>

      <section className="mt-5">
        <h3 className="mb-3 text-lg font-extrabold">עובדים נוספים ב{formatDate(day)}</h3>
        {uniqueCoworkers.length === 0 ? (
          <EmptyState text="אין עובדים נוספים ביום הזה." />
        ) : (
          <div className="grid gap-2">
            {uniqueCoworkers.map((other) => (
              <article key={other.id} className="card p-4">
                <p className="font-extrabold">
                  {other.user.name}
                  {other.trainee ? " (מתלמד)" : ""}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {other.jobType.name} · {other.site.name} · {formatShiftWhen(other)}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
