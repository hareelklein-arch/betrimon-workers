import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notificationHref } from "@/lib/notifications";

export default async function NotificationRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const item = await prisma.notification.findFirst({ where: { id, userId: user.id } });
  const fallback = user.role === "manager" ? "/manager" : "/worker";
  if (!item) {
    redirect(fallback);
  }

  if (!item.readAt) {
    await prisma.notification.update({ where: { id: item.id }, data: { readAt: new Date() } });
  }

  const href = notificationHref(item, user.role) || fallback;
  if (href.startsWith("/worker/shifts/")) {
    const shiftId = href.slice("/worker/shifts/".length);
    const shift = await prisma.shift.findUnique({ where: { id: shiftId }, select: { id: true, status: true } });
    if (!shift || shift.status === "cancelled") {
      redirect(fallback);
    }
  }

  redirect(href);
}
