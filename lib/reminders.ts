import { prisma } from "@/lib/db";
import { notifyUsers } from "@/lib/notifications";
import { addIsraelDays, israelDateKey, israelNowParts } from "@/lib/israel-time";
import { prismaShiftsInRange, shiftDateKey } from "@/lib/shift";

export async function sendTomorrowShiftReminders(now = new Date()) {
  const today = israelNowParts(now);
  if (today.hour !== 18) {
    return { ok: true as const, skipped: "not-18", sent: 0 };
  }

  const tomorrow = addIsraelDays(today, 1);
  const tomorrowKey = israelDateKey(tomorrow);
  const from = new Date(Date.UTC(tomorrow.year, tomorrow.month - 1, tomorrow.day - 1));
  const to = new Date(Date.UTC(tomorrow.year, tomorrow.month - 1, tomorrow.day + 1, 23, 59, 59));

  const shifts = await prisma.shift.findMany({
    where: prismaShiftsInRange(from, to),
    select: {
      id: true,
      userId: true,
      workDate: true,
      startsAt: true,
      user: { select: { name: true } },
      site: { select: { name: true } },
      jobType: { select: { name: true } },
    },
  });

  const due = shifts.filter((shift) => shiftDateKey(shift) === tomorrowKey);
  if (due.length === 0) return { ok: true as const, sent: 0 };

  const already = await prisma.notification.findMany({
    where: {
      type: "shift_reminder",
      createdAt: { gte: new Date(Date.UTC(today.year, today.month - 1, today.day)) },
    },
    select: { meta: true },
  });
  const sentIds = new Set(
    already
      .map((item) => {
        try {
          return JSON.parse(item.meta || "{}").shiftId as string | undefined;
        } catch {
          return undefined;
        }
      })
      .filter(Boolean),
  );

  let sent = 0;
  for (const shift of due) {
    if (sentIds.has(shift.id)) continue;
    await notifyUsers({
      userIds: [shift.userId],
      type: "shift_reminder",
      title: "תזכורת למשמרת",
      body: `${shift.user.name} תזכורת! מחר יש לך ניקיון ב${shift.site.name} · ${shift.jobType.name}`,
      meta: { shiftId: shift.id, date: tomorrowKey },
      urgent: true,
    });
    sent += 1;
  }

  return { ok: true as const, sent };
}
