import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageTitle, StatusBadge } from "@/components/shell";
import { formatDate, formatHours, formatMoney, formatTime } from "@/lib/format";
import { payAmount } from "@/lib/payroll";

export default async function HistoryPage() {
  const user = await requireUser();
  const entries = await prisma.timeEntry.findMany({
    where: { userId: user.id, status: { in: ["submitted", "approved"] } },
    include: { site: true, jobType: true },
    orderBy: { workDate: "desc" },
  });

  return (
    <>
      <PageTitle title="עבודות שסיימתי" subtitle="שיבוצים שכבר דיווחתם עליהם את השעות. ממתינים לאישור המנהל או שכבר אושרו." />
      {entries.length === 0 ? (
        <EmptyState text="עדיין אין עבודות שסיימתם. אחרי דיווח שעות הן יופיעו כאן." />
      ) : (
        <div className="grid gap-3">
          {entries.map((entry) => {
            const body = (
              <>
                <div className="mb-2 flex justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold">{entry.jobType.name}</h3>
                    <p className="text-[var(--muted)]">{entry.site.name} · {formatDate(entry.workDate)}</p>
                  </div>
                  <StatusBadge status={entry.status} />
                </div>
                {entry.startsAt && entry.endsAt ? (
                  <p className="text-sm">
                    <span>
                      {formatTime(entry.startsAt)} – {formatTime(entry.endsAt)}
                    </span>
                  </p>
                ) : null}
                <p>{formatHours(entry.hours)} × {formatMoney(entry.hourlyRate)}</p>
                {entry.status === "approved" ? (
                  <p className="font-bold">{formatMoney(payAmount(entry.hours, entry.hourlyRate))}</p>
                ) : null}
                {entry.note ? <p className="mt-2 text-sm">{entry.note}</p> : null}
              </>
            );
            return entry.shiftId ? (
              <Link key={entry.id} href={`/worker/shifts/${entry.shiftId}`} className="card block p-4">
                {body}
              </Link>
            ) : (
              <article key={entry.id} className="card p-4">
                {body}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
