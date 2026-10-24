import { endOfDay, formatDate, formatHours, formatTime, startOfDay, toDateInput } from "@/lib/format";
import { hoursBetween } from "@/lib/payroll";

export type Timed = {
  workDate?: Date | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export function dateKey(value: Date) {
  return toDateInput(startOfDay(value));
}

export function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return null;
  return startOfDay(new Date(year, month - 1, day));
}

export function combineDateAndTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const next = startOfDay(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export function shiftDay(shift: Timed) {
  return startOfDay(shift.workDate ?? shift.startsAt ?? new Date());
}

export function shiftDateKey(shift: Timed) {
  return dateKey(shiftDay(shift));
}

export function hasShiftTimes(shift: Timed): shift is Timed & { startsAt: Date; endsAt: Date } {
  return Boolean(shift.startsAt && shift.endsAt);
}

export function formatShiftWhen(shift: Timed) {
  if (hasShiftTimes(shift)) {
    return `${formatShiftDate(shift)} · ${formatShiftTimeRange(shift)}`;
  }
  return `${formatShiftDate(shift)} · שעות בתיאום בצ'אט`;
}

export function formatShiftDate(shift: Timed) {
  return formatDate(shiftDay(shift));
}

export function formatShiftTimeRange(shift: Timed) {
  if (!hasShiftTimes(shift)) return "שעות בתיאום בצ'אט";
  return `${formatTime(shift.startsAt)} עד ${formatTime(shift.endsAt)}`;
}

export function formatShiftHours(shift: Timed) {
  if (!hasShiftTimes(shift)) return "שעות עדיין לא נקבעו";
  return formatHours(hoursBetween(shift.startsAt, shift.endsAt));
}

export function isFutureShift(shift: Timed, now = new Date()) {
  if (shift.startsAt) return shift.startsAt > now;
  return endOfDay(shiftDay(shift)) > now;
}

export function swapExpiresAt(shift: Timed) {
  if (shift.startsAt) return new Date(shift.startsAt.getTime() - 6 * 36e5);
  return startOfDay(shiftDay(shift));
}

export function canRequestSwap(shift: Timed, now = new Date()) {
  const expires = swapExpiresAt(shift);
  return isFutureShift(shift, now) && expires > now;
}

export function assignmentKey(shift: Timed & { userId: string; jobTypeId: string; siteId: string }) {
  return `${shift.userId}|${shift.jobTypeId}|${shift.siteId}|${shiftDateKey(shift)}`;
}

export function shiftWasReported(entries: { status: string }[]) {
  return entries.some((entry) => entry.status === "submitted" || entry.status === "approved");
}

export function uniqueAssignments<T extends Timed & { userId: string; jobTypeId: string; siteId: string }>(shifts: T[]) {
  const seen = new Set<string>();
  return shifts.filter((shift) => {
    const key = assignmentKey(shift);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
