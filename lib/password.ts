import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export function normalizeUsername(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value);
  if (username.length < 2 || username.length > 32) {
    return { ok: false as const, error: "שם משתמש חייב להיות בין 2 ל-32 תווים." };
  }
  if (!/^[\p{L}\p{N}_.]+$/u.test(username)) {
    return { ok: false as const, error: "שם משתמש יכול להכיל אותיות, ספרות, נקודה וקו תחתון." };
  }
  return { ok: true as const, username };
}

export function validatePassword(value: string) {
  if (value.length < 6) {
    return { ok: false as const, error: "סיסמה חייבת לפחות 6 תווים." };
  }
  return { ok: true as const };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const left = Buffer.from(hash, "hex");
  if (left.length !== derived.length) return false;
  return timingSafeEqual(left, derived);
}
