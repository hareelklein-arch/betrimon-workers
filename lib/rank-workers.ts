import { hoursBetween } from "@/lib/payroll";
import { dateKey, shiftDay } from "@/lib/shift";
import { startOfDay } from "@/lib/format";

export type RankWorkerInput = { id: string; name: string };

export type RankShiftInput = {
  id: string;
  userId: string;
  jobTypeId: string;
  siteId: string;
  workDate?: Date | string | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
};

export type RankEntryInput = { userId: string; hours: number; shiftId?: string | null };

export type RankedWorker = {
  id: string;
  name: string;
  hours: number;
  shifts: number;
  assignedThatDay: boolean;
  assignedToThisJob: boolean;
  regular: boolean;
};

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function rankWorkersFromMonth(params: {
  workers: RankWorkerInput[];
  regularIds: Iterable<string>;
  entries: RankEntryInput[];
  shifts: RankShiftInput[];
  workDate: Date;
  job?: { jobTypeId?: string; siteId?: string };
}): RankedWorker[] {
  const from = startOfDay(new Date(params.workDate.getFullYear(), params.workDate.getMonth(), 1));
  const to = startOfDay(new Date(params.workDate.getFullYear(), params.workDate.getMonth() + 1, 0));
  const dayKey = dateKey(startOfDay(params.workDate));
  const regular = new Set(params.regularIds);

  const approvedHours = new Map<string, number>();
  const approvedShiftIds = new Set<string>();
  for (const entry of params.entries) {
    approvedHours.set(entry.userId, (approvedHours.get(entry.userId) ?? 0) + entry.hours);
    if (entry.shiftId) approvedShiftIds.add(entry.shiftId);
  }

  const scheduledHours = new Map<string, number>();
  const scheduledCount = new Map<string, number>();
  const assignedThatDay = new Set<string>();
  const assignedToThisJob = new Set<string>();

  for (const shift of params.shifts) {
    const timed = {
      workDate: asDate(shift.workDate),
      startsAt: asDate(shift.startsAt),
      endsAt: asDate(shift.endsAt),
    };
    const day = shiftDay(timed);
    if (dateKey(day) === dayKey) {
      assignedThatDay.add(shift.userId);
      if (
        params.job?.jobTypeId &&
        params.job?.siteId &&
        shift.jobTypeId === params.job.jobTypeId &&
        shift.siteId === params.job.siteId
      ) {
        assignedToThisJob.add(shift.userId);
      }
    }
    if (day < from || day > to) continue;
    scheduledCount.set(shift.userId, (scheduledCount.get(shift.userId) ?? 0) + 1);
    if (approvedShiftIds.has(shift.id)) continue;
    const extra = hoursBetween(timed.startsAt, timed.endsAt);
    if (extra > 0) {
      scheduledHours.set(shift.userId, (scheduledHours.get(shift.userId) ?? 0) + extra);
    }
  }

  return params.workers
    .map((worker) => {
      const hours = Math.round(((approvedHours.get(worker.id) ?? 0) + (scheduledHours.get(worker.id) ?? 0)) * 100) / 100;
      return {
        id: worker.id,
        name: worker.name,
        hours,
        shifts: scheduledCount.get(worker.id) ?? 0,
        assignedThatDay: assignedThatDay.has(worker.id),
        assignedToThisJob: assignedToThisJob.has(worker.id),
        regular: regular.has(worker.id),
      };
    })
    .sort((a, b) => a.hours - b.hours || a.shifts - b.shifts || a.name.localeCompare(b.name, "he"));
}
