import { createHmac } from "crypto";

export function joinToken() {
  if (process.env.JOIN_TOKEN) return process.env.JOIN_TOKEN;
  const secret = process.env.SESSION_SECRET || "local-dev-secret-change-me-32chars!";
  return createHmac("sha256", secret).update("betrimon-join-link").digest("hex").slice(0, 24);
}

export function isValidJoinToken(value: string | null | undefined) {
  return Boolean(value) && value === joinToken();
}
