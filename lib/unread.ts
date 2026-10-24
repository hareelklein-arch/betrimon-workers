import { prisma } from "@/lib/db";

export async function unreadCount(userId: string) {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}
