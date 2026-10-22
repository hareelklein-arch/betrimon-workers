import { prisma } from "@/lib/db";
import { endOfMonth, startOfMonth } from "@/lib/format";
import { payAmount } from "@/lib/payroll";

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
