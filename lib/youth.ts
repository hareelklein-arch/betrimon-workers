import { ageOn, formatHours } from "@/lib/format";
import { hoursBetween } from "@/lib/payroll";

type ShiftLike = {
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export function youthShiftWarnings(birthDate: Date | null | undefined, shift: ShiftLike, nearby: ShiftLike[] = []) {
  const warnings: string[] = [];
  if (!birthDate || !shift.startsAt || !shift.endsAt) {
    return warnings;
  }

  const age = ageOn(birthDate, shift.startsAt);
  const hours = hoursBetween(shift.startsAt, shift.endsAt);
  const startHour = shift.startsAt.getHours() + shift.startsAt.getMinutes() / 60;
  const endHour = shift.endsAt.getHours() + shift.endsAt.getMinutes() / 60;

  if (age < 16) {
    if (hours > 8) {
      warnings.push(`מתחת לגיל 16: משמרת של ${formatHours(hours)} ארוכה מהמותר (8 שעות).`);
    }
    if (startHour < 7) {
      warnings.push("מתחת לגיל 16: עבודה לפני 07:00.");
    }
    if (endHour > 20) {
      warnings.push("מתחת לגיל 16: עבודה אחרי 20:00.");
    }
  } else if (age < 18) {
    if (hours > 9) {
      warnings.push(`גיל 16–17: משמרת של ${formatHours(hours)} ארוכה מהמותר (9 שעות).`);
    }
    if (endHour > 23 || endHour < 6 && shift.endsAt.getDate() !== shift.startsAt.getDate()) {
      warnings.push("גיל 16–17: עבודה אחרי 23:00.");
    }
  }

  const restHours = 12;
  for (const other of nearby) {
    if (!other.startsAt || !other.endsAt) continue;
    const gapAfter = (other.startsAt.getTime() - shift.endsAt.getTime()) / 36e5;
    const gapBefore = (shift.startsAt.getTime() - other.endsAt.getTime()) / 36e5;
    if (gapAfter >= 0 && gapAfter < restHours) {
      warnings.push(`פחות מ-${restHours} שעות מנוחה עד המשמרת הבאה.`);
    }
    if (gapBefore >= 0 && gapBefore < restHours) {
      warnings.push(`פחות מ-${restHours} שעות מנוחה מהמשמרת הקודמת.`);
    }
  }

  return [...new Set(warnings)];
}

export function shiftsOverlap(a: ShiftLike, b: ShiftLike) {
  if (!a.startsAt || !a.endsAt || !b.startsAt || !b.endsAt) return false;
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}
