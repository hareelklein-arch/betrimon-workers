import { prisma } from "@/lib/db";
import { MonthBoard } from "@/components/month-board";
import { PageTitle } from "@/components/shell";
import { errorText, isNextControlFlow } from "@/lib/errors";
import { endOfMonth, startOfMonth } from "@/lib/format";
import { dateKey, prismaShiftsInRange, shiftDay, uniqueAssignments } from "@/lib/shift";

export default async function ManagerSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;
  const from = startOfMonth(year, month);
  from.setDate(from.getDate() - 1);
  const to = endOfMonth(year, month);
  to.setDate(to.getDate() + 1);

  let shifts;
  let sites;
  let jobs;
  let workers;
  let monthEntries: { userId: string; hours: number; shiftId: string | null }[] = [];
  let regularIds: string[] = [];
  try {
  const loaded = await Promise.all([
    prisma.shift.findMany({
      where: prismaShiftsInRange(from, to),
      select: {
        id: true,
        userId: true,
        trainee: true,
        jobTypeId: true,
        siteId: true,
        workDate: true,
        startsAt: true,
        endsAt: true,
        user: { select: { name: true } },
        site: { select: { name: true } },
        jobType: { select: { name: true } },
      },
    }),
    prisma.site.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.jobType.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { role: "worker", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.timeEntry.findMany({
      where: { status: "approved", workDate: { gte: from, lte: to } },
      select: { userId: true, hours: true, shiftId: true },
    }),
    prisma.shift.groupBy({
      by: ["userId"],
      where: { status: { not: "cancelled" } },
    }),
  ]);
  shifts = loaded[0];
  sites = loaded[1];
  jobs = loaded[2];
  workers = loaded[3];
  monthEntries = loaded[4];
  regularIds = loaded[5].map((row) => row.userId);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return (
      <div className="card p-6">
        <h2 className="text-xl font-black">לא הצלחנו לטעון את לוח השיבוץ</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm">{errorText(error)}</p>
      </div>
    );
  }

  const boardShifts = uniqueAssignments(shifts)
    .filter((shift) => {
      const day = shiftDay(shift);
      return day.getFullYear() === year && day.getMonth() + 1 === month;
    })
    .map((shift) => ({
      id: shift.id,
      userId: shift.userId,
      userName: shift.user.name,
      trainee: shift.trainee,
      jobTypeId: shift.jobTypeId,
      jobName: shift.jobType.name,
      siteId: shift.siteId,
      siteName: shift.site.name,
      date: dateKey(shiftDay(shift)),
      workDate: shift.workDate,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
    }));

  return (
    <>
      <PageTitle
        title="לוח שיבוץ חודשי"
        subtitle="אפשר לשבץ יום־יום, או להעלות טבלה והמערכת משבצת לפי השמות. מתלמדים מוסיפים ב־+ או בעמודת מתלמדים."
      />
      <MonthBoard
        key={`${year}-${month}`}
        year={year}
        month={month}
        shifts={boardShifts}
        sites={sites}
        jobs={jobs}
        workers={workers}
        monthEntries={monthEntries}
        regularIds={regularIds}
      />
    </>
  );
}
