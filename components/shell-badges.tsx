import Link from "next/link";
import { prisma } from "@/lib/db";
import { unreadCount } from "@/lib/unread";

export async function UnreadDot({ userId }: { userId: string }) {
  const unread = await unreadCount(userId).catch(() => 0);
  if (unread <= 0) return null;
  return (
    <span className="absolute -top-1 -left-1 min-w-5 rounded-full bg-[var(--danger)] px-1 text-center text-xs text-white">
      {unread}
    </span>
  );
}

export async function PendingWorkersBanner() {
  const pendingWorkers = await prisma.user.count({ where: { pendingApproval: true } }).catch(() => 0);
  if (pendingWorkers <= 0) return null;
  return (
    <Link href="/manager/people?tab=workers" className="card mb-4 block border-[var(--accent)] p-4">
      <p className="font-extrabold">יש עובדים לאשר</p>
      <p className="text-sm text-[var(--muted)]">
        {pendingWorkers === 1 ? "עובד אחד ממתין לאישור." : `${pendingWorkers} עובדים ממתינים לאישור.`}
      </p>
    </Link>
  );
}
