import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { startOfDay } from "@/lib/format";
import { notifyUsers } from "@/lib/notifications";
import { dateKey, shiftDay } from "@/lib/shift";

export async function assignShiftsForJob(params: {
  managerId: string;
  siteId: string;
  jobTypeId: string;
  workDate: Date;
  workerIds: string[];
  traineeIds: string[];
  notes?: string | null;
}) {
  const workerIds = [...new Set(params.workerIds)];
  const traineeIds = [...new Set(params.traineeIds)].filter((id) => !workerIds.includes(id));
  const warnings: string[] = [];
  const workDay = startOfDay(params.workDate);

  const alreadyAssigned = await prisma.shift.findMany({
    where: {
      jobTypeId: params.jobTypeId,
      siteId: params.siteId,
      status: { not: "cancelled" },
    },
    select: { userId: true, workDate: true, startsAt: true },
  });
  const taken = new Set(
    alreadyAssigned.filter((shift) => dateKey(shiftDay(shift)) === dateKey(workDay)).map((shift) => shift.userId),
  );

  async function assign(ids: string[], trainee: boolean) {
    const eligible: string[] = [];
    for (const userId of ids) {
      if (taken.has(userId)) {
        warnings.push("דילגנו על עובד שכבר משובץ לעבודה הזו.");
        continue;
      }
      eligible.push(userId);
      taken.add(userId);
    }

    for (const userId of eligible) {
      const shift = await prisma.shift.create({
        data: {
          userId,
          siteId: params.siteId,
          jobTypeId: params.jobTypeId,
          workDate: workDay,
          startsAt: null,
          endsAt: null,
          notes: params.notes ?? null,
          trainee,
          createdById: params.managerId,
        },
        include: { site: true, jobType: true, user: true },
      });

      await writeAudit({ userId: params.managerId, action: "create", entity: "shift", entityId: shift.id, after: shift });
      await notifyUsers({
        userIds: [userId],
        type: "shift_assigned",
        title: trainee ? "שובצת כמתלמד/ת" : "שובצת למשמרת",
        body: trainee
          ? `${shift.jobType.name} ב${shift.site.name}. שובצת כמתלמד/ת. אפשר לתאם שעות בצ'אט של התאריך, ואז לדווח.`
          : `${shift.jobType.name} ב${shift.site.name}. אפשר לתאם שעות בצ'אט של התאריך, ואז לדווח.`,
        meta: { shiftId: shift.id },
      });
    }

    return eligible.length;
  }

  const assignedWorkers = await assign(workerIds, false);
  const assignedTrainees = assignedWorkers > 0 ? await assign(traineeIds, true) : 0;

  return {
    assignedWorkers,
    assignedTrainees,
    warnings: [...new Set(warnings)],
  };
}
