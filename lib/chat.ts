import { prisma } from "@/lib/db";
import { parseDateKey, prismaShiftsOnDay, shiftWasReported } from "@/lib/shift";

export async function dateChatFinished(workDateKey: string) {
  const day = parseDateKey(workDateKey);
  if (!day) return false;
  const shifts = await prisma.shift.findMany({
    where: prismaShiftsOnDay(day),
    select: { timeEntries: { select: { status: true } } },
  });
  return dateWorkIsFinished(shifts);
}

export async function closeChatIfWorkDone(workDateKey: string) {
  try {
    const finished = await dateChatFinished(workDateKey);
    if (finished) {
      await prisma.dateChatMessage.deleteMany({ where: { workDateKey } });
    }
    return finished;
  } catch (error) {
    console.error("closeChatIfWorkDone", error);
    return false;
  }
}

export function dateWorkIsFinished(shiftsOnDate: { timeEntries: { status: string }[] }[]) {
  return shiftsOnDate.length === 0 || shiftsOnDate.every((shift) => shiftWasReported(shift.timeEntries));
}
