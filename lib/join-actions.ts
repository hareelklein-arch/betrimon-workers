"use server";

import { prisma } from "@/lib/db";
import { hashPassword, validatePassword, validateUsername } from "@/lib/password";
import { notifyUsers } from "@/lib/notifications";
import { normalizePhone } from "@/lib/format";
import { isValidJoinToken } from "@/lib/join";
import { errorText } from "@/lib/errors";

function formString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function registerWorkerAction(formData: FormData) {
  if (!isValidJoinToken(formString(formData, "token"))) {
    return { ok: false as const, error: "הקישור לרישום לא תקין." };
  }

  const name = formString(formData, "name");
  const usernameResult = validateUsername(formString(formData, "username"));
  const phone = normalizePhone(formString(formData, "phone"));
  const password = formString(formData, "password");
  const email = formString(formData, "email") || null;
  const parentPhone = formString(formData, "parentPhone") || null;
  const paymentMethod = formString(formData, "paymentMethod") || null;
  const bankDetails = formString(formData, "bankDetails") || null;
  const birthDateRaw = formString(formData, "birthDate");
  const birthDate = birthDateRaw ? new Date(birthDateRaw) : null;
  const passwordResult = validatePassword(password);

  if (!name || !phone) {
    return { ok: false as const, error: "שם וטלפון הם חובה." };
  }
  if (!usernameResult.ok) return { ok: false as const, error: usernameResult.error };
  if (!passwordResult.ok) return { ok: false as const, error: passwordResult.error };

  try {
    const user = await prisma.user.create({
      data: {
        name,
        username: usernameResult.username,
        phone,
        email,
        role: "worker",
        active: false,
        pendingApproval: true,
        passwordHash: await hashPassword(password),
        profile: {
          create: { parentPhone, paymentMethod, bankDetails, birthDate },
        },
      },
    });

    const managers = await prisma.user.findMany({
      where: { role: "manager", active: true },
      select: { id: true },
    });
    await notifyUsers({
      userIds: managers.map((row) => row.id),
      type: "worker_pending",
      title: "עובד חדש ממתין לאישור",
      body: `${name} נרשם/ה דרך קישור הרישום. צריך לאשר כדי שיוכל/תוכל להיכנס.`,
      meta: { userId: user.id },
    });

    return { ok: true as const };
  } catch (error) {
    const text = errorText(error);
    if (text.includes("P2002") && text.toLowerCase().includes("username")) {
      return { ok: false as const, error: "שם המשתמש כבר תפוס." };
    }
    if (text.includes("P2002") && text.toLowerCase().includes("phone")) {
      return { ok: false as const, error: "הטלפון כבר רשום במערכת." };
    }
    if (text.includes("P2002") && text.toLowerCase().includes("email")) {
      return { ok: false as const, error: "האימייל כבר רשום במערכת." };
    }
    if (text.includes("P2002")) {
      return { ok: false as const, error: "הפרטים האלה כבר רשומים במערכת." };
    }
    console.error("registerWorkerAction", error);
    return { ok: false as const, error: `לא הצלחנו לשמור את הרישום.\n${text}` };
  }
}
