import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageTitle } from "@/components/shell";
import { TimeEntryForm } from "@/components/forms";
import { toDateInput, toTimeInput } from "@/lib/format";
import { formatShiftWhen, shiftDay } from "@/lib/shift";

export default async function ReportPage() {
  const user = await requireUser();
  const [sites, jobs, shifts] = await Promise.all([
    prisma.site.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.jobType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.shift.findMany({
      where: {
        userId: user.id,
        status: { not: "cancelled" },
      },
      include: { site: true, jobType: true },
      orderBy: [{ workDate: "desc" }, { startsAt: "desc" }],
    }),
  ]);

  const recent = shifts.filter((shift) => {
    const day = shiftDay(shift);
    return day.getTime() >= Date.now() - 14 * 24 * 36e5;
  });

  return (
    <>
      <PageTitle title="דיווח שעות" subtitle="חובה למלא שעת התחלה ושעת סיום. המנהל מאשר לפני תשלום." />
      <TimeEntryForm
        sites={sites}
        jobs={jobs}
        shifts={recent.map((shift) => ({
          id: shift.id,
          label: `${formatShiftWhen(shift)} · ${shift.jobType.name} · ${shift.site.name}`,
          siteId: shift.siteId,
          jobTypeId: shift.jobTypeId,
          workDate: toDateInput(shiftDay(shift)),
          startTime: shift.startsAt ? toTimeInput(shift.startsAt) : undefined,
          endTime: shift.endsAt ? toTimeInput(shift.endsAt) : undefined,
        }))}
      />
    </>
  );
}
