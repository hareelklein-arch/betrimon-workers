"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireManager, requireUser } from "@/lib/auth";
import { hashPassword, validatePassword, validateUsername } from "@/lib/password";
import { writeAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { assertPeriodOpen } from "@/lib/period";
import { hoursBetween, rateForWorker } from "@/lib/payroll";
import { shiftsOverlap } from "@/lib/youth";
import { normalizePhone, startOfDay } from "@/lib/format";
import { workersRankedByLeastWork } from "@/lib/queries";
import { assignShiftsForJob } from "@/lib/assign-shifts";
import { closeChatIfWorkDone } from "@/lib/chat";
import { matchNamed, readScheduleFile } from "@/lib/schedule-import";
import { canRequestSwap, combineDateAndTime, dateKey, isFutureShift, parseDateKey, shiftDateKey, shiftDay, swapExpiresAt } from "@/lib/shift";

function formString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(Number.NaN);
  return new Date(year, month - 1, day);
}

function revalidateApp() {
  revalidatePath("/", "layout");
}


export async function submitTimeEntryAction(formData: FormData) {
  const user = await requireUser();
  const shiftId = formString(formData, "shiftId") || null;
  const siteId = formString(formData, "siteId");
  const jobTypeId = formString(formData, "jobTypeId");
  const workDate = parseDateInput(formString(formData, "workDate"));
  const startTime = formString(formData, "startTime");
  const endTime = formString(formData, "endTime");
  const note = formString(formData, "note") || null;
  const startsAt = combineDateAndTime(workDate, startTime);
  const endsAt = combineDateAndTime(workDate, endTime);
  const hours = hoursBetween(startsAt, endsAt);

  if (!siteId || !jobTypeId || Number.isNaN(workDate.getTime()) || !startsAt || !endsAt || hours <= 0 || hours > 24) {
    return { ok: false as const, error: "בדקו תאריך, מקום, סוג עבודה, שעת התחלה ושעת סיום." };
  }

  await assertPeriodOpen(workDate);

  if (user.role !== "manager" && shiftId) {
    const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift || shift.userId !== user.id) {
      return { ok: false as const, error: "אפשר לדווח רק על משמרת שלכם." };
    }
  }

  const hourlyRate = await rateForWorker(user.role === "manager" ? formString(formData, "userId") || user.id : user.id, jobTypeId, workDate);
  const workerId = user.role === "manager" && formString(formData, "userId") ? formString(formData, "userId") : user.id;

  const entry = await prisma.timeEntry.create({
    data: {
      userId: workerId,
      shiftId,
      siteId,
      jobTypeId,
      workDate,
      startsAt,
      endsAt,
      hours,
      hourlyRate,
      note,
      status: "submitted",
    },
  });

  if (shiftId) {
    await prisma.shift.update({
      where: { id: shiftId },
      data: { startsAt, endsAt, workDate },
    });
  }

  await writeAudit({ userId: user.id, action: "submit", entity: "time_entry", entityId: entry.id, after: entry });
  await closeChatIfWorkDone(dateKey(workDate));
  revalidateApp();
  return { ok: true as const };
}

export async function reviewTimeEntryAction(formData: FormData) {
  const manager = await requireManager();
  const id = formString(formData, "id");
  const decision = formString(formData, "decision");
  const rejectionReason = formString(formData, "rejectionReason") || null;
  const entry = await prisma.timeEntry.findUnique({ where: { id }, include: { user: true } });
  if (!entry) return { ok: false as const, error: "הדיווח לא נמצא." };

  await assertPeriodOpen(entry.workDate);

  if (decision === "approved") {
    const hourlyRate = await rateForWorker(entry.userId, entry.jobTypeId, entry.workDate);
    const updated = await prisma.timeEntry.update({
      where: { id },
      data: {
        status: "approved",
        hourlyRate,
        reviewedById: manager.id,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });
    await writeAudit({ userId: manager.id, action: "approve", entity: "time_entry", entityId: id, before: entry, after: updated });
  } else if (decision === "rejected") {
    const updated = await prisma.timeEntry.update({
      where: { id },
      data: {
        status: "rejected",
        reviewedById: manager.id,
        reviewedAt: new Date(),
        rejectionReason,
      },
    });
    await writeAudit({ userId: manager.id, action: "reject", entity: "time_entry", entityId: id, before: entry, after: updated });
    await notifyUsers({
      userIds: [entry.userId],
      type: "time_entry_rejected",
      title: "דיווח נדחה",
      body: `${manager.name} דחה דיווח שעות. ${rejectionReason || ""}`.trim(),
      meta: { shiftId: entry.shiftId },
    });
  } else {
    return { ok: false as const, error: "החלטה לא תקינה." };
  }

  revalidateApp();
  return { ok: true as const };
}

async function overlappingShift(userId: string, startsAt: Date | null, endsAt: Date | null, ignoreId?: string) {
  if (!startsAt || !endsAt) return undefined;
  const existing = await prisma.shift.findMany({
    where: {
      userId,
      status: { not: "cancelled" },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
  });
  return existing.find((shift) => shiftsOverlap({ startsAt, endsAt }, shift));
}

export async function suggestWorkersAction(formData: FormData) {
  await requireManager();
  const workDate = parseDateInput(formString(formData, "workDate"));
  if (Number.isNaN(workDate.getTime())) {
    return { ok: false as const, error: "בחרו תאריך." };
  }
  const workers = await workersRankedByLeastWork(workDate, {
    jobTypeId: formString(formData, "jobTypeId") || undefined,
    siteId: formString(formData, "siteId") || undefined,
  });
  return { ok: true as const, workers };
}

export async function createShiftAction(formData: FormData) {
  const manager = await requireManager();
  const userIds = formData.getAll("userId").map((value) => String(value).trim()).filter(Boolean);
  const traineeIds = formData.getAll("traineeId").map((value) => String(value).trim()).filter(Boolean);
  const siteId = formString(formData, "siteId");
  const jobTypeId = formString(formData, "jobTypeId");
  const workDate = parseDateInput(formString(formData, "workDate"));
  const notes = formString(formData, "notes") || null;

  const uniqueWorkerIds = [...new Set(userIds)];
  const uniqueTraineeIds = [...new Set(traineeIds)].filter((id) => !uniqueWorkerIds.includes(id));
  if (!siteId || !jobTypeId || Number.isNaN(workDate.getTime())) {
    return { ok: false as const, error: "בחרו תאריך, סוג עבודה ומקום." };
  }
  if (uniqueWorkerIds.length < 2) {
    return { ok: false as const, error: "חייבים לפחות 2 עובדים. מתלמדים מוסיפים בנפרד." };
  }
  if (uniqueWorkerIds.length > 4) {
    return { ok: false as const, error: "אפשר לשבץ עד 4 עובדים." };
  }

  const alreadyAssigned = await prisma.shift.findMany({
    where: { jobTypeId, siteId, status: { not: "cancelled" }, trainee: false },
    select: { userId: true, workDate: true, startsAt: true },
  });
  const alreadyIds = new Set(
    alreadyAssigned.filter((shift) => dateKey(shiftDay(shift)) === dateKey(startOfDay(workDate))).map((shift) => shift.userId),
  );
  const newWorkerIds = uniqueWorkerIds.filter((id) => !alreadyIds.has(id));
  if (alreadyIds.size + newWorkerIds.length > 4) {
    return { ok: false as const, error: "בעבודה הזו כבר יש מספיק עובדים. מקסימום 4." };
  }

  const result = await assignShiftsForJob({
    managerId: manager.id,
    siteId,
    jobTypeId,
    workDate,
    workerIds: uniqueWorkerIds,
    traineeIds: uniqueTraineeIds,
    notes,
  });
  if (result.assignedWorkers < 1) {
    return { ok: false as const, error: "כל העובדים שנבחרו כבר משובצים לעבודה הזו." };
  }

  revalidateApp();
  return { ok: true as const, warnings: result.warnings };
}

export async function importScheduleAction(formData: FormData) {
  const manager = await requireManager();
  const file = formData.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function" || file.size === 0) {
    return { ok: false as const, error: "בחרו קובץ טבלה להעלאה." };
  }
  if (file.size > 2_000_000) {
    return { ok: false as const, error: "הקובץ גדול מדי. עד 2MB." };
  }

  const parsed = await readScheduleFile(Buffer.from(await file.arrayBuffer()), file.name || "schedule.csv");
  if (parsed.error) return { ok: false as const, error: parsed.error };
  if (parsed.rows.length === 0) {
    return { ok: false as const, error: "הטבלה ריקה. צריך שורת כותרות ולפחות שורת שיבוץ אחת." };
  }
  if (parsed.rows.length > 400) {
    return { ok: false as const, error: "יותר מדי שורות. פצלו לטבלה של עד 400 שורות." };
  }

  const [sites, jobs, workers] = await Promise.all([
    prisma.site.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.jobType.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: "worker", active: true }, select: { id: true, name: true } }),
  ]);

  const warnings: string[] = [];
  const groups = new Map<
    string,
    { date: Date; siteId: string; jobTypeId: string; workerIds: string[]; traineeIds: string[]; label: string }
  >();

  for (const row of parsed.rows) {
    if (!row.date) {
      warnings.push(`שורה ${row.line}: תאריך לא מובן (${row.dateRaw || "ריק"}).`);
      continue;
    }
    if (!row.jobName || !row.siteName) {
      warnings.push(`שורה ${row.line}: חסרים סוג עבודה או מקום.`);
      continue;
    }
    const job = matchNamed(row.jobName, jobs);
    const site = matchNamed(row.siteName, sites);
    if (!job) {
      warnings.push(`שורה ${row.line}: לא מצאנו סוג עבודה בשם «${row.jobName}».`);
      continue;
    }
    if (!site) {
      warnings.push(`שורה ${row.line}: לא מצאנו מקום בשם «${row.siteName}».`);
      continue;
    }
    if (row.workerNames.length + row.traineeNames.length === 0) {
      warnings.push(`שורה ${row.line}: אין שמות עובדים.`);
      continue;
    }

    const key = `${dateKey(row.date)}|${job.id}|${site.id}`;
    const group = groups.get(key) ?? {
      date: startOfDay(row.date),
      siteId: site.id,
      jobTypeId: job.id,
      workerIds: [] as string[],
      traineeIds: [] as string[],
      label: `${job.name} · ${site.name} · ${dateKey(row.date)}`,
    };

    for (const name of row.workerNames) {
      const user = matchNamed(name, workers);
      if (!user) {
        warnings.push(`שורה ${row.line}: לא מצאנו עובד בשם «${name}».`);
        continue;
      }
      if (!group.workerIds.includes(user.id) && !group.traineeIds.includes(user.id)) {
        group.workerIds.push(user.id);
      }
    }
    for (const name of row.traineeNames) {
      const user = matchNamed(name, workers);
      if (!user) {
        warnings.push(`שורה ${row.line}: לא מצאנו מתלמד בשם «${name}».`);
        continue;
      }
      if (group.workerIds.includes(user.id) || group.traineeIds.includes(user.id)) continue;
      group.traineeIds.push(user.id);
    }
    groups.set(key, group);
  }

  let assigned = 0;
  let jobsCount = 0;
  for (const group of groups.values()) {
    if (group.workerIds.length < 1) {
      warnings.push(`${group.label}: צריך לפחות עובד אחד (מתלמדים לבד לא מספיק).`);
      continue;
    }
    const result = await assignShiftsForJob({
      managerId: manager.id,
      siteId: group.siteId,
      jobTypeId: group.jobTypeId,
      workDate: group.date,
      workerIds: group.workerIds,
      traineeIds: group.traineeIds,
    });
    const created = result.assignedWorkers + result.assignedTrainees;
    if (created > 0) {
      assigned += created;
      jobsCount += 1;
    } else {
      warnings.push(`${group.label}: כולם כבר משובצים לעבודה הזו.`);
    }
    for (const warning of result.warnings) {
      warnings.push(`${group.label}: ${warning}`);
    }
  }

  if (assigned === 0) {
    return {
      ok: false as const,
      error: "לא נוצרו שיבוצים. בדקו שמות, תאריכים וסוגי עבודה בטבלה.",
      warnings: [...new Set(warnings)],
    };
  }

  revalidateApp();
  return {
    ok: true as const,
    assigned,
    jobs: jobsCount,
    warnings: [...new Set(warnings)],
  };
}

export async function cancelShiftAction(formData: FormData) {
  return cancelShiftsAction(formData);
}

export async function cancelShiftsAction(formData: FormData) {
  const manager = await requireManager();
  const ids = [...new Set(formData.getAll("id").map((value) => String(value).trim()).filter(Boolean))];
  if (ids.length === 0) return { ok: false as const, error: "לא נבחרו משמרות." };

  for (const id of ids) {
    const before = await prisma.shift.findUnique({ where: { id }, include: { jobType: true, site: true } });
    if (!before || before.status === "cancelled") continue;
    await prisma.shift.update({ where: { id }, data: { status: "cancelled" } });
    await prisma.swapRequest.updateMany({ where: { shiftId: id, status: "open" }, data: { status: "cancelled" } });
    await writeAudit({ userId: manager.id, action: "cancel", entity: "shift", entityId: id, before });
    await notifyUsers({
      userIds: [before.userId],
      type: "shift_cancelled",
      title: "משמרת בוטלה",
      body: `${before.jobType.name} ב${before.site.name} בוטלה.`,
      meta: { shiftId: id },
    });
    await closeChatIfWorkDone(shiftDateKey(before));
  }

  revalidateApp();
  return { ok: true as const };
}

export async function requestSwapAction(formData: FormData) {
  const user = await requireUser();
  const shiftId = formString(formData, "shiftId");
  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, include: { site: true, jobType: true } });
  if (!shift || shift.userId !== user.id) {
    return { ok: false as const, error: "אפשר לבקש החלפה רק למשמרת שלכם." };
  }
  if (shift.status === "cancelled") {
    return { ok: false as const, error: "אי אפשר להחליף משמרת שבוטלה." };
  }
  if (!canRequestSwap(shift)) {
    return { ok: false as const, error: "אפשר לבקש החלפה רק למשמרת עתידית, לפני שפג הזמן." };
  }

  const open = await prisma.swapRequest.findFirst({ where: { shiftId, status: "open" } });
  if (open) {
    return { ok: false as const, error: "כבר יש בקשת החלפה פתוחה למשמרת הזו." };
  }

  const expiresAt = swapExpiresAt(shift);

  const request = await prisma.swapRequest.create({
    data: { shiftId, requesterId: user.id, expiresAt },
  });

  const others = await prisma.user.findMany({
    where: { active: true, role: "worker", id: { not: user.id } },
    select: { id: true },
  });

  await notifyUsers({
    userIds: others.map((row) => row.id),
    type: "swap_requested",
    title: "בקשת החלפה",
    body: `${user.name} מבקש/ת החלפה: ${shift.jobType.name} ב${shift.site.name}`,
    meta: { swapRequestId: request.id },
  });

  revalidateApp();
  return { ok: true as const };
}

export async function takeSwapAction(formData: FormData) {
  const user = await requireUser();
  const id = formString(formData, "id");
  const request = await prisma.swapRequest.findUnique({
    where: { id },
    include: { shift: true, requester: true },
  });
  if (!request || request.status !== "open") {
    return { ok: false as const, error: "הבקשה כבר לא פתוחה." };
  }
  if (request.requesterId === user.id) {
    return { ok: false as const, error: "אי אפשר לקחת את הבקשה של עצמכם." };
  }
  if (request.expiresAt <= new Date() || !isFutureShift(request.shift)) {
    await prisma.swapRequest.update({ where: { id }, data: { status: "expired" } });
    return { ok: false as const, error: "פג תוקף הבקשה." };
  }

  const overlap = await overlappingShift(user.id, request.shift.startsAt, request.shift.endsAt);
  if (overlap) {
    return { ok: false as const, error: "יש לכם משמרת חופפת באותו זמן." };
  }

  await prisma.$transaction([
    prisma.swapRequest.update({
      where: { id },
      data: { status: "taken", takerId: user.id },
    }),
    prisma.shift.update({
      where: { id: request.shiftId },
      data: { userId: user.id, status: "swapped" },
    }),
  ]);

  await notifyUsers({
    userIds: [request.requesterId],
    type: "swap_taken",
    title: "ההחלפה בוצעה",
    body: `${user.name} לקח/ה את המשמרת במקומכם.`,
    meta: { swapRequestId: request.id, takerId: user.id },
  });

  revalidateApp();
  return { ok: true as const };
}

export async function upsertNamedItemAction(formData: FormData) {
  const manager = await requireManager();
  const kind = formString(formData, "kind");
  const id = formString(formData, "id");
  const name = formString(formData, "name");
  const active = formString(formData, "active") !== "false";
  if (!name) return { ok: false as const, error: "צריך שם." };

  if (kind === "site") {
    const row = id
      ? await prisma.site.update({ where: { id }, data: { name, active } })
      : await prisma.site.create({ data: { name, active } });
    await writeAudit({ userId: manager.id, action: id ? "update" : "create", entity: "site", entityId: row.id, after: row });
  } else if (kind === "job") {
    const row = id
      ? await prisma.jobType.update({ where: { id }, data: { name, active } })
      : await prisma.jobType.create({ data: { name, active } });
    await writeAudit({ userId: manager.id, action: id ? "update" : "create", entity: "job_type", entityId: row.id, after: row });
  } else {
    return { ok: false as const, error: "סוג לא מוכר." };
  }

  revalidateApp();
  return { ok: true as const };
}

export async function upsertWorkerAction(formData: FormData) {
  const manager = await requireManager();
  const id = formString(formData, "id");
  const name = formString(formData, "name");
  const usernameResult = validateUsername(formString(formData, "username"));
  const phone = normalizePhone(formString(formData, "phone"));
  const password = formString(formData, "password");
  const email = formString(formData, "email") || null;
  const role = formString(formData, "role") === "manager" ? "manager" : "worker";
  const active = formData.get("active") === "true";
  const parentPhone = formString(formData, "parentPhone") || null;
  const paymentMethod = formString(formData, "paymentMethod") || null;
  const bankDetails = formString(formData, "bankDetails") || null;
  const birthDateRaw = formString(formData, "birthDate");
  const personalRateRaw = formString(formData, "personalRate");
  const birthDate = birthDateRaw ? new Date(birthDateRaw) : null;
  const personalRate = personalRateRaw ? Number(personalRateRaw) : null;

  if (!name || !phone) {
    return { ok: false as const, error: "שם וטלפון הם חובה." };
  }
  if (!usernameResult.ok) {
    return { ok: false as const, error: usernameResult.error };
  }
  if (!id && !password) {
    return { ok: false as const, error: "צריך לבחור סיסמה לחשבון חדש." };
  }
  if (password) {
    const passwordResult = validatePassword(password);
    if (!passwordResult.ok) return { ok: false as const, error: passwordResult.error };
  }

  const taken = await prisma.user.findFirst({
    where: { username: usernameResult.username, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  if (taken) {
    return { ok: false as const, error: "שם המשתמש כבר תפוס." };
  }

  const data = {
    name,
    username: usernameResult.username,
    phone,
    email,
    role,
    active,
    ...(password ? { passwordHash: await hashPassword(password) } : {}),
  };
  const user = id
    ? await prisma.user.update({ where: { id }, data })
    : await prisma.user.create({ data: { ...data, passwordHash: data.passwordHash as string } });

  if (role === "worker") {
    await prisma.workerProfile.upsert({
      where: { userId: user.id },
      update: { parentPhone, paymentMethod, bankDetails, birthDate, personalRate },
      create: { userId: user.id, parentPhone, paymentMethod, bankDetails, birthDate, personalRate },
    });
  }

  await writeAudit({ userId: manager.id, action: id ? "update" : "create", entity: "user", entityId: user.id, after: user });
  revalidateApp();
  return { ok: true as const };
}

export async function upsertPayRateAction(formData: FormData) {
  const manager = await requireManager();
  const id = formString(formData, "id");
  const jobTypeId = formString(formData, "jobTypeId") || null;
  const userId = formString(formData, "userId") || null;
  const minAge = formString(formData, "minAge") ? Number(formString(formData, "minAge")) : null;
  const maxAge = formString(formData, "maxAge") ? Number(formString(formData, "maxAge")) : null;
  const hourlyRate = Number(formString(formData, "hourlyRate"));
  if (!hourlyRate || hourlyRate <= 0) {
    return { ok: false as const, error: "צריך תעריף לשעה." };
  }

  const row = id
    ? await prisma.payRate.update({ where: { id }, data: { jobTypeId, userId, minAge, maxAge, hourlyRate, active: true } })
    : await prisma.payRate.create({ data: { jobTypeId, userId, minAge, maxAge, hourlyRate } });

  await writeAudit({ userId: manager.id, action: id ? "update" : "create", entity: "pay_rate", entityId: row.id, after: row });
  revalidateApp();
  return { ok: true as const };
}

export async function togglePayRateAction(formData: FormData) {
  const manager = await requireManager();
  const id = formString(formData, "id");
  const active = formString(formData, "active") === "true";
  const row = await prisma.payRate.update({ where: { id }, data: { active } });
  await writeAudit({ userId: manager.id, action: "update", entity: "pay_rate", entityId: id, after: row });
  revalidateApp();
  return { ok: true as const };
}

export async function deletePayRateAction(formData: FormData) {
  const manager = await requireManager();
  const id = formString(formData, "id");
  const before = await prisma.payRate.findUnique({ where: { id } });
  if (!before) return { ok: false as const, error: "התעריף לא נמצא." };
  await prisma.payRate.delete({ where: { id } });
  await writeAudit({ userId: manager.id, action: "delete", entity: "pay_rate", entityId: id, before });
  revalidateApp();
  return { ok: true as const };
}

export async function deleteWorkerAction(formData: FormData) {
  const manager = await requireManager();
  const id = formString(formData, "id");
  if (!id) return { ok: false as const, error: "חסר מזהה." };
  if (id === manager.id) return { ok: false as const, error: "אי אפשר למחוק את עצמך." };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { ok: false as const, error: "העובד לא נמצא." };

  if (user.role === "manager") {
    const otherManagers = await prisma.user.count({ where: { role: "manager", id: { not: id } } });
    if (otherManagers === 0) {
      return { ok: false as const, error: "אי אפשר למחוק את המנהל האחרון." };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.shift.updateMany({ where: { createdById: id }, data: { createdById: manager.id } });
    await tx.timeEntry.updateMany({ where: { reviewedById: id }, data: { reviewedById: null } });
    await tx.timeEntry.deleteMany({ where: { userId: id } });
    await tx.swapRequest.deleteMany({ where: { requesterId: id } });
    await tx.swapRequest.updateMany({ where: { takerId: id }, data: { takerId: null } });
    await tx.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
    await tx.payrollPeriod.updateMany({ where: { lockedById: id }, data: { lockedById: null } });
    await tx.shift.deleteMany({ where: { userId: id } });
    await tx.user.delete({ where: { id } });
  });

  await writeAudit({ userId: manager.id, action: "delete", entity: "user", entityId: id, before: user });
  revalidateApp();
  return { ok: true as const };
}

export async function deleteNamedItemAction(formData: FormData) {
  const manager = await requireManager();
  const kind = formString(formData, "kind");
  const id = formString(formData, "id");
  if (!id) return { ok: false as const, error: "חסר מזהה." };

  if (kind === "site") {
    const before = await prisma.site.findUnique({ where: { id } });
    if (!before) return { ok: false as const, error: "המקום לא נמצא." };
    await prisma.$transaction(async (tx) => {
      await tx.timeEntry.deleteMany({ where: { siteId: id } });
      await tx.shift.deleteMany({ where: { siteId: id } });
      await tx.site.delete({ where: { id } });
    });
    await writeAudit({ userId: manager.id, action: "delete", entity: "site", entityId: id, before });
  } else if (kind === "job") {
    const before = await prisma.jobType.findUnique({ where: { id } });
    if (!before) return { ok: false as const, error: "סוג העבודה לא נמצא." };
    await prisma.$transaction(async (tx) => {
      await tx.timeEntry.deleteMany({ where: { jobTypeId: id } });
      await tx.shift.deleteMany({ where: { jobTypeId: id } });
      await tx.jobType.delete({ where: { id } });
    });
    await writeAudit({ userId: manager.id, action: "delete", entity: "job_type", entityId: id, before });
  } else {
    return { ok: false as const, error: "סוג לא מוכר." };
  }

  revalidateApp();
  return { ok: true as const };
}

export async function lockPeriodAction(formData: FormData) {
  const manager = await requireManager();
  const year = Number(formString(formData, "year"));
  const month = Number(formString(formData, "month"));
  const lock = formString(formData, "lock") === "true";

  const period = await prisma.payrollPeriod.upsert({
    where: { year_month: { year, month } },
    update: {
      lockedAt: lock ? new Date() : null,
      lockedById: lock ? manager.id : null,
    },
    create: {
      year,
      month,
      lockedAt: lock ? new Date() : null,
      lockedById: lock ? manager.id : null,
    },
  });

  await writeAudit({
    userId: manager.id,
    action: lock ? "lock" : "unlock",
    entity: "payroll_period",
    entityId: period.id,
    after: period,
  });
  revalidateApp();
  return { ok: true as const };
}

export async function markNotificationsReadAction() {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidateApp();
}

export async function canAccessDateChat(userId: string, role: string, workDateKey: string) {
  if (role === "manager") return true;
  const shifts = await prisma.shift.findMany({
    where: { userId, status: { not: "cancelled" } },
  });
  return shifts.some((shift) => shiftDateKey(shift) === workDateKey);
}

export async function sendDateChatAction(formData: FormData) {
  const user = await requireUser();
  const workDateKey = formString(formData, "workDateKey");
  const body = formString(formData, "body");
  const day = parseDateKey(workDateKey);
  if (!day || !body) {
    return { ok: false as const, error: "כתבו הודעה קצרה." };
  }
  if (body.length > 500) {
    return { ok: false as const, error: "ההודעה ארוכה מדי." };
  }
  if (!(await canAccessDateChat(user.id, user.role, workDateKey))) {
    return { ok: false as const, error: "אפשר להשתתף רק בצ'אט של תאריך ששובצתם אליו." };
  }
  if (await closeChatIfWorkDone(workDateKey)) {
    return { ok: false as const, error: "העבודה הסתיימה והצ'אט נסגר." };
  }

  await prisma.dateChatMessage.create({
    data: { workDateKey, userId: user.id, body },
  });
  revalidateApp();
  return { ok: true as const };
}
