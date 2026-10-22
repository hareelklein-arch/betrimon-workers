import { endOfDay, formatDate, formatDateTime, formatHours, formatTime, startOfDay, toDateInput } from "@/lib/format";
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
    return `${formatDateTime(shift.startsAt)} – ${formatTime(shift.endsAt)}`;
  }
  return `${formatDate(shiftDay(shift))} · שעות בתיאום בצ'אט`;
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
