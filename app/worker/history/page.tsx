import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageTitle, StatusBadge } from "@/components/shell";
import { formatDate, formatHours, formatMoney } from "@/lib/format";
import { payAmount } from "@/lib/payroll";

export default async function HistoryPage() {
  const user = await requireUser();
  const entries = await prisma.timeEntry.findMany({
    where: { userId: user.id },
    include: { site: true, jobType: true },
    orderBy: { workDate: "desc" },
  });

  return (
    <>
      <PageTitle title="היסטוריית עבודות" subtitle="כל הדיווחים שלכם — מאושרים, ממתינים ונדחים." />
      {entries.length === 0 ? (
        <EmptyState text="עדיין אין דיווחים." />
      ) : (
        <div className="grid gap-3">
          {entries.map((entry) => (
            <article key={entry.id} className="card p-4">
              <div className="mb-2 flex justify-between gap-3">
                <div>
                  <h3 className="font-extrabold">{entry.jobType.name}</h3>
                  <p className="text-[var(--muted)]">{entry.site.name} · {formatDate(entry.workDate)}</p>
                </div>
                <StatusBadge status={entry.status} />
              </div>
              <p>{formatHours(entry.hours)} × {formatMoney(entry.hourlyRate)}</p>
              {entry.status === "approved" ? (
                <p className="font-bold">{formatMoney(payAmount(entry.hours, entry.hourlyRate))}</p>
              ) : null}
              {entry.note ? <p className="mt-2 text-sm">{entry.note}</p> : null}
              {entry.rejectionReason ? (
                <p className="mt-2 text-sm text-[var(--danger)]">{entry.rejectionReason}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
