import { prisma } from "@/lib/db";
import { dateKey, shiftDay } from "@/lib/shift";
import { endOfMonth, startOfDay, startOfMonth } from "@/lib/format";
import { hoursBetween, payAmount } from "@/lib/payroll";

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
    include: {
      user: { include: { profile: true } },
      site: true,
      jobType: true,
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
    include: { site: true, jobType: true },
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
  const dayKey = dateKey(startOfDay(workDate));

  const [workers, entries, shifts] = await Promise.all([
    prisma.user.findMany({
      where: { role: "worker", active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        assignedShifts: { where: { status: { not: "cancelled" } }, take: 1, select: { id: true } },
      },
    }),
    prisma.timeEntry.findMany({
      where: { status: "approved", workDate: { gte: from, lte: to } },
      select: { userId: true, hours: true, shiftId: true },
    }),
    prisma.shift.findMany({
      where: {
        status: { not: "cancelled" },
        OR: [
          { workDate: { gte: from, lte: to } },
          { workDate: null, startsAt: { gte: from, lte: to } },
        ],
      },
      select: { id: true, userId: true, workDate: true, startsAt: true, endsAt: true, jobTypeId: true, siteId: true },
    }),
  ]);

  const approvedHours = new Map<string, number>();
  const approvedShiftIds = new Set<string>();
  for (const entry of entries) {
    approvedHours.set(entry.userId, (approvedHours.get(entry.userId) ?? 0) + entry.hours);
    if (entry.shiftId) approvedShiftIds.add(entry.shiftId);
  }

  const scheduledHours = new Map<string, number>();
  const scheduledCount = new Map<string, number>();
  const assignedThatDay = new Set<string>();
  const assignedToThisJob = new Set<string>();

  for (const shift of shifts) {
    const day = shiftDay(shift);
    if (dateKey(day) === dayKey) {
      assignedThatDay.add(shift.userId);
      if (job?.jobTypeId && job?.siteId && shift.jobTypeId === job.jobTypeId && shift.siteId === job.siteId) {
        assignedToThisJob.add(shift.userId);
      }
    }
    if (day < from || day > to) continue;
    scheduledCount.set(shift.userId, (scheduledCount.get(shift.userId) ?? 0) + 1);
    if (approvedShiftIds.has(shift.id)) continue;
    const extra = hoursBetween(shift.startsAt, shift.endsAt);
    if (extra > 0) {
      scheduledHours.set(shift.userId, (scheduledHours.get(shift.userId) ?? 0) + extra);
    }
  }

  const hasWorked = new Set(workers.filter((worker) => worker.assignedShifts.length > 0).map((worker) => worker.id));

  return workers
    .map((worker) => {
      const hours = Math.round(((approvedHours.get(worker.id) ?? 0) + (scheduledHours.get(worker.id) ?? 0)) * 100) / 100;
      return {
        id: worker.id,
        name: worker.name,
        hours,
        shifts: scheduledCount.get(worker.id) ?? 0,
        assignedThatDay: assignedThatDay.has(worker.id),
        assignedToThisJob: assignedToThisJob.has(worker.id),
        regular: hasWorked.has(worker.id),
      };
    })
    .sort((a, b) => a.hours - b.hours || a.shifts - b.shifts || a.name.localeCompare(b.name, "he"));
}
