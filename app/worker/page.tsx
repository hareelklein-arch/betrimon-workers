import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageTitle } from "@/components/shell";
import { ShiftAssignmentCard } from "@/components/shift-card";
import { formatTime, startOfDay } from "@/lib/format";
import { parseNotificationShiftId } from "@/lib/notifications";
import { hoursBetween } from "@/lib/payroll";
import { formatShiftDate, hasShiftTimes, shiftDay, shiftWasReported, uniqueAssignments } from "@/lib/shift";

export default async function WorkerHomePage() {
  const user = await requireUser();
  const from = startOfDay(new Date());

  const [shifts, unreadAssignments] = await Promise.all([
    prisma.shift.findMany({
      where: {
        userId: user.id,
        status: { not: "cancelled" },
        OR: [{ workDate: { gte: from } }, { workDate: null, startsAt: { gte: from } }],
      },
      select: {
        id: true,
        userId: true,
        jobTypeId: true,
        siteId: true,
        createdAt: true,
        status: true,
        notes: true,
        trainee: true,
        workDate: true,
        startsAt: true,
        endsAt: true,
        site: { select: { name: true } },
        jobType: { select: { name: true } },
        timeEntries: { select: { status: true } },
      },
      orderBy: [{ workDate: "asc" }, { startsAt: "asc" }],
    }),
    prisma.notification.findMany({
      where: { userId: user.id, type: "shift_assigned", readAt: null },
      select: { meta: true },
    }),
  ]);

  const upcoming = uniqueAssignments(
    shifts.filter((shift) => shiftDay(shift) >= from && !shiftWasReported(shift.timeEntries)),
  );
  const newShiftIds = new Set(unreadAssignments.map((item) => parseNotificationShiftId(item.meta)).filter(Boolean) as string[]);
  const hasUnlinkedUnread = unreadAssignments.some((item) => !parseNotificationShiftId(item.meta));
  const fiveDays = 5 * 24 * 36e5;

  const ranked = [...upcoming].sort((a, b) => {
    const aNew = newShiftIds.has(a.id) || (hasUnlinkedUnread && Date.now() - a.createdAt.getTime() < fiveDays);
    const bNew = newShiftIds.has(b.id) || (hasUnlinkedUnread && Date.now() - b.createdAt.getTime() < fiveDays);
    if (aNew !== bNew) return aNew ? -1 : 1;
    return shiftDay(a).getTime() - shiftDay(b).getTime();
  });

  const newCount = ranked.filter(
    (shift) => newShiftIds.has(shift.id) || (hasUnlinkedUnread && Date.now() - shift.createdAt.getTime() < fiveDays),
  ).length;

  return (
    <>
      <PageTitle
        title="השיבוצים שלך"
        subtitle="כשהמנהל משבץ אתכם זה מופיע כאן מיד. לחצו על שיבוץ כדי לראות את כל הפרטים."
      />
      {newCount > 0 ? (
        <p className="mb-4 rounded-2xl bg-[#e7f3ea] px-4 py-3 font-bold text-[var(--ok)]">
          {newCount === 1 ? "שובצת למשמרת חדשה." : `שובצת ל-${newCount} משמרות חדשות.`}
        </p>
      ) : null}
      {ranked.length === 0 ? (
        <EmptyState text="עדיין לא שובצת. כשהמנהל ישבץ, זה יופיע כאן." />
      ) : (
        <div className="grid gap-3">
          {ranked.map((shift) => {
            const isNew = newShiftIds.has(shift.id) || (hasUnlinkedUnread && Date.now() - shift.createdAt.getTime() < fiveDays);
            return (
              <ShiftAssignmentCard
                key={shift.id}
                href={`/worker/shifts/${shift.id}`}
                jobName={shift.jobType.name}
                siteName={shift.site.name}
                dateLabel={formatShiftDate(shift)}
                startTime={hasShiftTimes(shift) ? formatTime(shift.startsAt) : null}
                endTime={hasShiftTimes(shift) ? formatTime(shift.endsAt) : null}
                hours={hasShiftTimes(shift) ? Math.round(hoursBetween(shift.startsAt, shift.endsAt) * 100) / 100 : null}
                status={shift.status}
                isNew={isNew}
                notes={shift.notes}
                trainee={shift.trainee}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
