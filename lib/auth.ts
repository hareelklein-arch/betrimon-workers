import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/format";

export type SessionUser = {
  id: string;
  name: string;
  phone: string;
  role: "worker" | "manager";
};

const sessionOptions: SessionOptions = {
  cookieName: "betrimon_session",
  password: process.env.SESSION_SECRET || "local-dev-secret-change-me-32chars!",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function codesMatch(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<{ user?: SessionUser }>(cookieStore, sessionOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { profile: true },
  });
  if (!user || !user.active) return null;
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireManager() {
  const user = await requireUser();
  if (user.role !== "manager") {
    redirect("/worker");
  }
  return user;
}

export async function requireWorker() {
  const user = await requireUser();
  if (user.role !== "manager") {
    return user;
  }
  return user;
}

export async function sendOtp(phoneInput: string) {
  const phone = normalizePhone(phoneInput);
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.active) {
    return { ok: false as const, error: "לא נמצא עובד עם מספר הטלפון הזה." };
  }

  const demoCode = process.env.DEMO_OTP || "123456";
  const code = process.env.NODE_ENV === "production" ? String(randomInt(100000, 999999)) : demoCode;

  await prisma.otpCode.create({
    data: {
      phone,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  return {
    ok: true as const,
    demoCode: process.env.NODE_ENV === "production" ? undefined : code,
  };
}

export async function verifyOtp(phoneInput: string, code: string) {
  const phone = normalizePhone(phoneInput);
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.active) {
    return { ok: false as const, error: "לא נמצא עובד עם מספר הטלפון הזה." };
  }

  const otp = await prisma.otpCode.findFirst({
    where: {
      phone,
      consumed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp || !codesMatch(otp.codeHash, hashCode(code.trim()))) {
    return { ok: false as const, error: "הקוד שגוי או שפג תוקפו." };
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { consumed: true },
  });

  const session = await getSession();
  session.user = {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role as "worker" | "manager",
  };
  await session.save();

  return { ok: true as const, role: user.role };
}

export async function logout() {
  const session = await getSession();
  session.destroy();
}
