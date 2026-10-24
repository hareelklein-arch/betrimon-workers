import { prisma } from "@/lib/db";
import { shiftDateKey, shiftWasReported } from "@/lib/shift";

export async function dateChatFinished(workDateKey: string) {
  const shifts = await prisma.shift.findMany({
    where: { status: { not: "cancelled" } },
    include: { timeEntries: { select: { status: true } } },
  });
  const onDate = shifts.filter((shift) => shiftDateKey(shift) === workDateKey);
  return dateWorkIsFinished(onDate);
}

export async function closeChatIfWorkDone(workDateKey: string) {
  const finished = await dateChatFinished(workDateKey);
  if (finished) {
    await prisma.dateChatMessage.deleteMany({ where: { workDateKey } });
  }
  return finished;
}

export function dateWorkIsFinished(shiftsOnDate: { timeEntries: { status: string }[] }[]) {
  return shiftsOnDate.length === 0 || shiftsOnDate.every((shift) => shiftWasReported(shift.timeEntries));
}
