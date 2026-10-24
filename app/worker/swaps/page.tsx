import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionButton } from "@/components/forms";
import { EmptyState, PageTitle, StatusBadge } from "@/components/shell";
import { takeSwapAction } from "@/lib/actions";
import { formatShiftWhen } from "@/lib/shift";
import { expireOpenSwaps } from "@/lib/queries";

export default async function WorkerSwapsPage() {
  const user = await requireUser();
  await expireOpenSwaps();

  const [mine, open] = await Promise.all([
    prisma.swapRequest.findMany({
      where: { requesterId: user.id },
      include: { shift: { include: { site: true, jobType: true } }, taker: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.swapRequest.findMany({
      where: { status: "open", requesterId: { not: user.id } },
      include: { shift: { include: { site: true, jobType: true } }, requester: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <PageTitle title="החלפות" subtitle="עובד אחר לוקח את המשמרת. אין צורך באישור מנהל." />

      <h3 className="mb-2 text-lg font-extrabold">בקשות פתוחות של אחרים</h3>
      {open.length === 0 ? (
        <EmptyState text="אין כרגע בקשות שאפשר לקחת." />
      ) : (
        <div className="mb-6 grid gap-3">
          {open.map((request) => (
            <article key={request.id} className="card p-4">
              <p className="font-bold">{request.requester.name} מבקש/ת החלפה</p>
              <p>{request.shift.jobType.name} · {request.shift.site.name}</p>
              <p className="text-sm text-[var(--muted)]">{formatShiftWhen(request.shift)}</p>
              <div className="mt-3">
                <ActionButton action={takeSwapAction} label="אני לוקח/ת את זה" hidden={{ id: request.id }} />
              </div>
            </article>
          ))}
        </div>
      )}

      <h3 className="mb-2 text-lg font-extrabold">הבקשות שלי</h3>
      {mine.length === 0 ? (
        <EmptyState text="עוד לא ביקשתם החלפה." />
      ) : (
        <div className="grid gap-3">
          {mine.map((request) => (
            <article key={request.id} className="card p-4">
              <div className="mb-2 flex justify-between">
                <p className="font-bold">{request.shift.jobType.name} · {request.shift.site.name}</p>
                <StatusBadge status={request.status} />
              </div>
              <p className="text-sm text-[var(--muted)]">{formatShiftWhen(request.shift)}</p>
              {request.taker ? <p className="mt-2">לקח/ה: {request.taker.name}</p> : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
