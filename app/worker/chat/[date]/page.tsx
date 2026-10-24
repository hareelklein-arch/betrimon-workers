import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canAccessDateChat } from "@/lib/actions";
import { ChatForm, ChatRefresh } from "@/components/chat-form";
import { EmptyState, PageTitle } from "@/components/shell";
import { dateWorkIsFinished } from "@/lib/chat";
import { formatDate, formatTime } from "@/lib/format";
import { parseDateKey, shiftDateKey, formatShiftWhen } from "@/lib/shift";

export default async function DateChatPage({ params }: { params: Promise<{ date: string }> }) {
  const user = await requireUser();
  const { date } = await params;
  const day = parseDateKey(date);
  if (!day) notFound();
  if (!(await canAccessDateChat(user.id, user.role, date))) notFound();

  const allShifts = await prisma.shift.findMany({
    where: { status: { not: "cancelled" } },
    include: { user: true, site: true, jobType: true, timeEntries: { select: { status: true } } },
    orderBy: { startsAt: "asc" },
  });
  const onDate = allShifts.filter((shift) => shiftDateKey(shift) === date);
  const finished = dateWorkIsFinished(onDate);
  if (finished) {
    await prisma.dateChatMessage.deleteMany({ where: { workDateKey: date } });
  }
  const messages = finished
    ? []
    : await prisma.dateChatMessage.findMany({
        where: { workDateKey: date },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      });

  return (
    <>
      <ChatRefresh />
      <PageTitle
        title={`צ'אט · ${formatDate(day)}`}
        subtitle="רק מי ששובץ ליום הזה רואה את הקבוצה. כאן מתאמים שעת התחלה וסיום."
      />
      <div className="card mb-4 p-4">
        <h3 className="mb-2 font-extrabold">מי עובד היום</h3>
        {onDate.length === 0 ? (
          <p className="text-[var(--muted)]">אין שיבוצים ליום הזה.</p>
        ) : (
          <ul className="grid gap-2">
            {onDate.map((shift) => (
              <li key={shift.id}>
                <span className="font-bold">{shift.user.name}</span>
                <span className="text-[var(--muted)]"> · {shift.jobType.name} · {shift.site.name} · {formatShiftWhen(shift)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {finished ? (
        <EmptyState text="העבודה הסתיימה והצ'אט נמחק." />
      ) : messages.length === 0 ? (
        <EmptyState text="אין הודעות עדיין. כתבו מתי אתם יכולים לעבוד." />
      ) : (
        <div className="grid gap-2">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`card p-3 ${message.userId === user.id ? "border-[var(--primary)]" : ""}`}
            >
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="font-bold">{message.user.name}</span>
                <span className="text-[var(--muted)]">{formatTime(message.createdAt)}</span>
              </div>
              <p>{message.body}</p>
            </article>
          ))}
        </div>
      )}
      {finished ? null : <ChatForm workDateKey={date} />}
    </>
  );
}
