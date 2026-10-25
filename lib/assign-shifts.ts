import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { afterResponse } from "@/lib/background";
import { startOfDay } from "@/lib/format";
import { notifyUsers } from "@/lib/notifications";
import { prismaShiftsOnDay } from "@/lib/shift";

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
      ...prismaShiftsOnDay(workDay),
    },
    select: { userId: true },
  });
  const taken = new Set(alreadyAssigned.map((shift) => shift.userId));

  function eligibleFrom(ids: string[]) {
    const eligible: string[] = [];
    for (const userId of ids) {
      if (taken.has(userId)) {
        warnings.push("דילגנו על עובד שכבר משובץ לעבודה הזו.");
        continue;
      }
      eligible.push(userId);
      taken.add(userId);
    }
    return eligible;
  }

  const workers = eligibleFrom(workerIds);
  const trainees = workers.length > 0 ? eligibleFrom(traineeIds) : [];
  const rows = [
    ...workers.map((userId) => ({ userId, trainee: false })),
    ...trainees.map((userId) => ({ userId, trainee: true })),
  ];

  if (rows.length === 0) {
    return { assignedWorkers: 0, assignedTrainees: 0, warnings: [...new Set(warnings)] };
  }

  const created = await prisma.shift.createManyAndReturn({
    data: rows.map((row) => ({
      userId: row.userId,
      siteId: params.siteId,
      jobTypeId: params.jobTypeId,
      workDate: workDay,
      startsAt: null,
      endsAt: null,
      notes: params.notes ?? null,
      trainee: row.trainee,
      createdById: params.managerId,
    })),
  });

  afterResponse(async () => {
    const [site, job] = await Promise.all([
      prisma.site.findUnique({ where: { id: params.siteId }, select: { name: true } }),
      prisma.jobType.findUnique({ where: { id: params.jobTypeId }, select: { name: true } }),
    ]);
    const siteName = site?.name ?? "";
    const jobName = job?.name ?? "";
    await Promise.all(
      created.map(async (shift) => {
        await writeAudit({ userId: params.managerId, action: "create", entity: "shift", entityId: shift.id, after: shift });
        await notifyUsers({
          userIds: [shift.userId],
          type: "shift_assigned",
          title: shift.trainee ? "שובצת כמתלמד/ת" : "שובצת למשמרת",
          body: shift.trainee
            ? `${jobName} ב${siteName}. שובצת כמתלמד/ת. אפשר לתאם שעות בצ'אט של התאריך, ואז לדווח.`
            : `${jobName} ב${siteName}. אפשר לתאם שעות בצ'אט של התאריך, ואז לדווח.`,
          meta: { shiftId: shift.id },
        });
      }),
    );
  });

  return {
    assignedWorkers: workers.length,
    assignedTrainees: trainees.length,
    warnings: [...new Set(warnings)],
  };
}
