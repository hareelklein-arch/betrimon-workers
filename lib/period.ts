import { prisma } from "@/lib/db";

export function periodFromDate(value: Date) {
  return { year: value.getFullYear(), month: value.getMonth() + 1 };
}

export async function isPeriodLocked(date: Date) {
  const { year, month } = periodFromDate(date);
  const period = await prisma.payrollPeriod.findUnique({
    where: { year_month: { year, month } },
  });
  return Boolean(period?.lockedAt);
}

export async function assertPeriodOpen(date: Date) {
  if (await isPeriodLocked(date)) {
    throw new Error("החודש הזה נעול. המנהל צריך לפתוח אותו מחדש כדי לשנות דיווחים.");
  }
}
