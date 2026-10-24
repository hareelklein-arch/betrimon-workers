"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
