import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { normalizeUsername, verifyPassword } from "@/lib/password";

export type SessionUser = {
  id: string;
  name: string;
  phone: string;
  role: "worker" | "manager";
};

export function demoAuthEnabled() {
  return process.env.NODE_ENV !== "production";
}

function sessionPassword() {
  const secret = process.env.SESSION_SECRET || "";
  if (process.env.NODE_ENV === "production") {
    if (secret.length < 32) {
      throw new Error("SESSION_SECRET must be at least 32 characters in production.");
    }
    return secret;
  }
  return secret || "local-dev-secret-change-me-32chars!";
}

function sessionOptions(): SessionOptions {
  return {
    cookieName: "betrimon_session",
    password: sessionPassword(),
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<{ user?: SessionUser }>(cookieStore, sessionOptions());
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      active: true,
      profile: true,
    },
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

export async function loginWithPassword(usernameInput: string, password: string) {
  const username = normalizeUsername(usernameInput);
  const user = username ? await prisma.user.findUnique({ where: { username } }) : null;
  const invalid = { ok: false as const, error: "שם משתמש או סיסמה שגויים." };

  if (!user || !user.active || !user.passwordHash) {
    return invalid;
  }
  const matches = await verifyPassword(password, user.passwordHash);
  if (!matches) return invalid;

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
