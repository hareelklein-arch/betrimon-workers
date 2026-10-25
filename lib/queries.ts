import { prisma } from "@/lib/db";
import { prismaShiftsInRange } from "@/lib/shift";
import { endOfMonth, startOfMonth } from "@/lib/format";
import { payAmount } from "@/lib/payroll";
import { rankWorkersFromMonth } from "@/lib/rank-workers";

export async function expireOpenSwaps() {
  await prisma.swapRequest.updateMany({
    where: { status: "open", expiresAt: { lte: new Date() } },
    data: { status: "expired" },
  });
}

export async function payrollReport(year: number, month: number) {
  const from = startOfMonth(year, month);
  const to = endOfMonth(year, month);
  const entries = await prisma.timeEntry.findMany({
    where: {
      status: "approved",
      workDate: { gte: from, lte: to },
    },
    select: {
      userId: true,
      hours: true,
      hourlyRate: true,
      workDate: true,
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          profile: { select: { bankDetails: true, paymentMethod: true } },
        },
      },
      site: { select: { name: true } },
      jobType: { select: { name: true } },
    },
    orderBy: [{ user: { name: "asc" } }, { workDate: "asc" }],
  });

  const byWorker = new Map<
    string,
    {
      user: (typeof entries)[number]["user"];
      hours: number;
      amount: number;
      entries: typeof entries;
    }
  >();

  for (const entry of entries) {
    const current = byWorker.get(entry.userId) ?? {
      user: entry.user,
      hours: 0,
      amount: 0,
      entries: [],
    };
    current.hours += entry.hours;
    current.amount += payAmount(entry.hours, entry.hourlyRate);
    current.entries.push(entry);
    byWorker.set(entry.userId, current);
  }

  const workers = [...byWorker.values()].map((row) => ({
    ...row,
    hours: Math.round(row.hours * 100) / 100,
    amount: Math.round(row.amount * 100) / 100,
  }));

  return {
    year,
    month,
    from,
    to,
    workers,
    totalHours: Math.round(workers.reduce((sum, row) => sum + row.hours, 0) * 100) / 100,
    totalAmount: Math.round(workers.reduce((sum, row) => sum + row.amount, 0) * 100) / 100,
  };
}

export async function workerStats(userId: string) {
  const entries = await prisma.timeEntry.findMany({
    where: { userId, status: "approved" },
    select: { hours: true, hourlyRate: true, workDate: true, siteId: true, site: { select: { name: true } } },
    orderBy: { workDate: "asc" },
  });

  const byMonth = new Map<string, { year: number; month: number; hours: number; amount: number }>();
  const bySite = new Map<string, { name: string; hours: number; amount: number }>();

  for (const entry of entries) {
    const year = entry.workDate.getFullYear();
    const month = entry.workDate.getMonth() + 1;
    const key = `${year}-${month}`;
    const monthRow = byMonth.get(key) ?? { year, month, hours: 0, amount: 0 };
    monthRow.hours += entry.hours;
    monthRow.amount += payAmount(entry.hours, entry.hourlyRate);
    byMonth.set(key, monthRow);

    const siteRow = bySite.get(entry.siteId) ?? { name: entry.site.name, hours: 0, amount: 0 };
    siteRow.hours += entry.hours;
    siteRow.amount += payAmount(entry.hours, entry.hourlyRate);
    bySite.set(entry.siteId, siteRow);
  }

  return {
    months: [...byMonth.values()]
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .map((row) => ({
        ...row,
        hours: Math.round(row.hours * 100) / 100,
        amount: Math.round(row.amount * 100) / 100,
      })),
    sites: [...bySite.values()]
      .sort((a, b) => b.amount - a.amount)
      .map((row) => ({
        ...row,
        hours: Math.round(row.hours * 100) / 100,
        amount: Math.round(row.amount * 100) / 100,
      })),
    totalHours: Math.round(entries.reduce((sum, entry) => sum + entry.hours, 0) * 100) / 100,
    totalAmount: Math.round(entries.reduce((sum, entry) => sum + payAmount(entry.hours, entry.hourlyRate), 0) * 100) / 100,
  };
}

export async function workersRankedByLeastWork(workDate: Date, job?: { jobTypeId?: string; siteId?: string }) {
  const from = startOfMonth(workDate.getFullYear(), workDate.getMonth() + 1);
  const to = endOfMonth(workDate.getFullYear(), workDate.getMonth() + 1);

  const [workers, entries, shifts, regulars] = await Promise.all([
    prisma.user.findMany({
      where: { role: "worker", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.timeEntry.findMany({
      where: { status: "approved", workDate: { gte: from, lte: to } },
      select: { userId: true, hours: true, shiftId: true },
    }),
    prisma.shift.findMany({
      where: prismaShiftsInRange(from, to),
      select: { id: true, userId: true, workDate: true, startsAt: true, endsAt: true, jobTypeId: true, siteId: true },
    }),
    prisma.shift.groupBy({
      by: ["userId"],
      where: { status: { not: "cancelled" } },
    }),
  ]);

  return rankWorkersFromMonth({
    workers,
    regularIds: regulars.map((row) => row.userId),
    entries,
    shifts,
    workDate,
    job,
  });
}
