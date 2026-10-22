import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { ActionButton } from "@/components/forms";
import { ShiftForm } from "@/components/manager-forms";
import { EmptyState, PageTitle, StatusBadge } from "@/components/shell";
import { cancelShiftAction } from "@/lib/actions";
import { formatShiftHours, formatShiftWhen } from "@/lib/shift";
import { startOfDay } from "@/lib/format";
import { youthShiftWarnings } from "@/lib/youth";

export default async function ManagerSchedulePage() {
  await requireManager();
  const from = startOfDay(new Date());
  from.setDate(from.getDate() - 1);
  const [shifts, workers, sites, jobs] = await Promise.all([
    prisma.shift.findMany({
      where: { status: { not: "cancelled" } },
      include: { user: { include: { profile: true } }, site: true, jobType: true },
      orderBy: [{ workDate: "asc" }, { startsAt: "asc" }],
    }),
    prisma.user.findMany({ where: { role: "worker", active: true }, orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.jobType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const upcoming = shifts.filter((shift) => {
    const day = shift.workDate ?? shift.startsAt;
    return day != null && day >= from;
  });

  return (
    <>
      <PageTitle title="לוח שיבוץ" subtitle="קובעים מי עובד, איפה ומתי. שעת התחלה וסיום לא חובה — העובדים יכולים לתאם אותן בצ'אט של התאריך." />
      <ShiftForm workers={workers} sites={sites} jobs={jobs} />
      <h3 className="mb-2 mt-6 text-lg font-extrabold">משמרות קרובות</h3>
      {upcoming.length === 0 ? (
        <EmptyState text="אין משמרות קרובות." />
      ) : (
        <div className="grid gap-3">
          {upcoming.map((shift) => {
            const warnings = youthShiftWarnings(shift.user.profile?.birthDate, shift);
            return (
              <article key={shift.id} className="card p-4">
                <div className="mb-2 flex justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-extrabold">{shift.user.name}</h3>
                    <p className="text-[var(--muted)]">{shift.jobType.name} · {shift.site.name}</p>
                  </div>
                  <StatusBadge status={shift.status} />
                </div>
                <p>{formatShiftWhen(shift)}</p>
                <p className="text-sm text-[var(--muted)]">{formatShiftHours(shift)}</p>
                {shift.user.profile?.parentPhone ? (
                  <p className="mt-1 text-sm">הורה: {shift.user.profile.parentPhone}</p>
                ) : null}
                {warnings.map((warning) => (
                  <p key={warning} className="mt-1 text-sm font-bold text-[var(--accent)]">{warning}</p>
                ))}
                <div className="mt-3">
                  <ActionButton
                    action={cancelShiftAction}
                    label="ביטול משמרת"
                    className="btn btn-danger"
                    hidden={{ id: shift.id }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
