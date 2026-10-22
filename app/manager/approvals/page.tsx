import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { ReviewForm } from "@/components/forms";
import { EmptyState, PageTitle, StatusBadge } from "@/components/shell";
import { formatDate, formatHours, formatMoney } from "@/lib/format";
import { payAmount } from "@/lib/payroll";

export default async function ApprovalsPage() {
  await requireManager();
  const entries = await prisma.timeEntry.findMany({
    where: { status: "submitted" },
    include: { user: true, site: true, jobType: true },
    orderBy: { workDate: "desc" },
  });

  return (
    <>
      <PageTitle title="אישור שעות" subtitle="בלי אישור אין שכר. מאשרים רק מה שבאמת עבדו." />
      {entries.length === 0 ? (
        <EmptyState text="אין דיווחים שממתינים לאישור." />
      ) : (
        <div className="grid gap-3">
          {entries.map((entry) => (
            <article key={entry.id} className="card p-4">
              <div className="mb-2 flex justify-between">
                <div>
                  <h3 className="text-lg font-extrabold">{entry.user.name}</h3>
                  <p className="text-[var(--muted)]">{entry.jobType.name} · {entry.site.name}</p>
                </div>
                <StatusBadge status={entry.status} />
              </div>
              <p>{formatDate(entry.workDate)} · {formatHours(entry.hours)} × {formatMoney(entry.hourlyRate)}</p>
              <p className="font-bold">{formatMoney(payAmount(entry.hours, entry.hourlyRate))}</p>
              {entry.note ? <p className="mt-2 text-sm">{entry.note}</p> : null}
              <div className="mt-3">
                <ReviewForm id={entry.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
