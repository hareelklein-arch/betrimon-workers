import { prisma } from "@/lib/db";
import webpush from "web-push";

function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configurePush() {
  if (!pushConfigured()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@betrimon.local",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
}

export async function notifyUsers(params: {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  meta?: unknown;
}) {
  if (params.userIds.length === 0) return;

  try {
  const created = await prisma.$transaction(
    params.userIds.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          type: params.type,
          title: params.title,
          body: params.body,
          meta: params.meta ? JSON.stringify(params.meta) : null,
        },
      }),
    ),
  );
  const idByUser = new Map(created.map((item) => [item.userId, item.id]));

  if (!pushConfigured()) return;
  configurePush();

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: params.userIds } },
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        const notificationId = idByUser.get(sub.userId);
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: params.title,
            body: params.body,
            url: notificationId
              ? `/n/${notificationId}`
              : notificationHref({ type: params.type, meta: params.meta ? JSON.stringify(params.meta) : null }, "worker"),
          }),
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        }
      }
    }),
  );
  } catch (error) {
    console.error("notifyUsers", error);
  }
}

export function parseNotificationMeta(meta: string | null) {
  if (!meta) return {} as { shiftId?: string; swapRequestId?: string };
  try {
    return JSON.parse(meta) as { shiftId?: string; swapRequestId?: string };
  } catch {
    return {};
  }
}

export function parseNotificationShiftId(meta: string | null) {
  return parseNotificationMeta(meta).shiftId || null;
}

export function notificationHref(item: { type: string; meta: string | null }, role: string) {
  const meta = parseNotificationMeta(item.meta);
  const home = role === "manager" ? "/manager" : "/worker";
  const swaps = role === "manager" ? "/manager/swaps" : "/worker/swaps";
  if (item.type === "swap_requested" || item.type === "swap_taken" || meta.swapRequestId) {
    return swaps;
  }
  if (item.type === "time_entry_rejected") {
    return meta.shiftId ? `/worker/shifts/${meta.shiftId}` : "/worker/history";
  }
  if (item.type === "shift_cancelled") {
    return home;
  }
  if (item.type === "worker_pending") {
    return "/manager/people?tab=workers";
  }
  if (meta.shiftId) {
    return `/worker/shifts/${meta.shiftId}`;
  }
  return home;
}

export function notificationCta(type: string) {
  if (type === "swap_requested" || type === "swap_taken") return "לחצו לדף ההחלפות";
  if (type === "time_entry_rejected") return "לחצו לפרטי השיבוץ";
  if (type === "shift_cancelled") return "לחצו לשיבוצים";
  if (type === "shift_assigned") return "לחצו לפרטי השיבוץ";
  if (type === "worker_pending") return "לחצו לאישור העובדים";
  return "לחצו לפתיחה";
}
