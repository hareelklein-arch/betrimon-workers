"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, logout, requireManager, requireUser, sendOtp, verifyOtp } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { assertPeriodOpen } from "@/lib/period";
import { hoursBetween, rateForWorker } from "@/lib/payroll";
import { shiftsOverlap, youthShiftWarnings } from "@/lib/youth";
import { normalizePhone, startOfDay } from "@/lib/format";
import { canRequestSwap, combineDateAndTime, isFutureShift, parseDateKey, shiftDateKey, swapExpiresAt } from "@/lib/shift";

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

export async function requestOtpAction(formData: FormData) {
  return sendOtp(formString(formData, "phone"));
}

export async function verifyOtpAction(formData: FormData) {
  return verifyOtp(formString(formData, "phone"), formString(formData, "code"));
}

export async function logoutAction() {
  await logout();
  redirect("/login");
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

export async function createShiftAction(formData: FormData) {
  const manager = await requireManager();
  const userId = formString(formData, "userId");
  const siteId = formString(formData, "siteId");
  const jobTypeId = formString(formData, "jobTypeId");
  const workDate = parseDateInput(formString(formData, "workDate"));
  const startTime = formString(formData, "startTime");
  const endTime = formString(formData, "endTime");
  const notes = formString(formData, "notes") || null;
  const startsAt = startTime ? combineDateAndTime(workDate, startTime) : null;
  const endsAt = endTime ? combineDateAndTime(workDate, endTime) : null;

  if (!userId || !siteId || !jobTypeId || Number.isNaN(workDate.getTime())) {
    return { ok: false as const, error: "חסרים פרטי משמרת תקינים." };
  }
  if ((startTime && !endTime) || (!startTime && endTime)) {
    return { ok: false as const, error: "אפשר להשאיר שעות ריקות, או למלא גם התחלה וגם סיום." };
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    return { ok: false as const, error: "שעת הסיום צריכה להיות אחרי ההתחלה." };
  }

  const overlap = await overlappingShift(userId, startsAt, endsAt);
  if (overlap) {
    return { ok: false as const, error: "לעובד כבר יש משמרת חופפת." };
  }

  const worker = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
  const nearby = await prisma.shift.findMany({
    where: { userId, status: { not: "cancelled" } },
  });
  const warnings = youthShiftWarnings(worker?.profile?.birthDate, { startsAt, endsAt }, nearby);

  const shift = await prisma.shift.create({
    data: { userId, siteId, jobTypeId, workDate: startOfDay(workDate), startsAt, endsAt, notes, createdById: manager.id },
    include: { site: true, jobType: true, user: true },
  });

  await writeAudit({ userId: manager.id, action: "create", entity: "shift", entityId: shift.id, after: shift });
  await notifyUsers({
    userIds: [userId],
    type: "shift_assigned",
    title: "שובצת למשמרת",
    body: `${shift.jobType.name} ב${shift.site.name}. אפשר לתאם שעות בצ'אט של התאריך.`,
  });

  revalidateApp();
  return { ok: true as const, warnings };
}

export async function cancelShiftAction(formData: FormData) {
  const manager = await requireManager();
  const id = formString(formData, "id");
  const before = await prisma.shift.findUnique({ where: { id } });
  if (!before) return { ok: false as const, error: "המשמרת לא נמצאה." };
  await prisma.shift.update({ where: { id }, data: { status: "cancelled" } });
  await prisma.swapRequest.updateMany({ where: { shiftId: id, status: "open" }, data: { status: "cancelled" } });
  await writeAudit({ userId: manager.id, action: "cancel", entity: "shift", entityId: id, before });
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
  if (shift.status !== "scheduled") {
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
    title: "אישרו את ההחלפה",
    body: `${user.name} אישר/ה את בקשת ההחלפה ולקח/ה את המשמרת.`,
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
  const phone = normalizePhone(formString(formData, "phone"));
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

  const data = { name, phone, email, role, active };
  const user = id
    ? await prisma.user.update({ where: { id }, data })
    : await prisma.user.create({ data });

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

export async function savePushSubscriptionAction(payload: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const };
  await prisma.pushSubscription.upsert({
    where: { endpoint: payload.endpoint },
    update: { userId: user.id, p256dh: payload.keys.p256dh, auth: payload.keys.auth },
    create: {
      userId: user.id,
      endpoint: payload.endpoint,
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
    },
  });
  return { ok: true as const };
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

  await prisma.dateChatMessage.create({
    data: { workDateKey, userId: user.id, body },
  });
  revalidateApp();
  return { ok: true as const };
}
