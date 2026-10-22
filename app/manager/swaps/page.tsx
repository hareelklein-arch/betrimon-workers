import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { EmptyState, PageTitle, StatusBadge } from "@/components/shell";
import { formatShiftWhen } from "@/lib/shift";
import { expireOpenSwaps } from "@/lib/queries";

export default async function ManagerSwapsPage() {
  await requireManager();
  await expireOpenSwaps();
  const requests = await prisma.swapRequest.findMany({
    include: {
      requester: true,
      taker: true,
      shift: { include: { site: true, jobType: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageTitle title="בקשות החלפה" subtitle="כל הבקשות במערכת, כולל מי ביקש ומי אישר." />
      {requests.length === 0 ? (
        <EmptyState text="אין בקשות החלפה." />
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => (
            <article key={request.id} className="card p-4">
              <div className="mb-2 flex justify-between">
                <h3 className="font-extrabold">{request.requester.name}</h3>
                <StatusBadge status={request.status} />
              </div>
              <p>{request.shift.jobType.name} · {request.shift.site.name}</p>
              <p className="text-sm text-[var(--muted)]">{formatShiftWhen(request.shift)}</p>
              {request.taker ? <p className="mt-2">לקח/ה: {request.taker.name}</p> : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
