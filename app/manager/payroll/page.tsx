import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { LockPeriodForm } from "@/components/manager-forms";
import { EmptyState, PageTitle } from "@/components/shell";
import { formatHours, formatMoney, formatMonth } from "@/lib/format";
import { payrollReport } from "@/lib/queries";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await requireManager();
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;
  const report = await payrollReport(year, month);
  const period = await prisma.payrollPeriod.findUnique({
    where: { year_month: { year, month } },
  });
  const locked = Boolean(period?.lockedAt);

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <>
      <PageTitle
        title={`דוח שכר · ${formatMonth(year, month)}`}
        subtitle="שעות מאושרות כפול תעריף. זה הסכום לתשלום, בלי מס ובלי נטו."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <a className="btn btn-secondary" href={`/manager/payroll?year=${prev.year}&month=${prev.month}`}>
          חודש קודם
        </a>
        <a className="btn btn-secondary" href={`/manager/payroll?year=${next.year}&month=${next.month}`}>
          חודש הבא
        </a>
        <a className="btn" href={`/manager/payroll/export?year=${year}&month=${month}`}>
          ייצוא ל-Excel
        </a>
        <LockPeriodForm year={year} month={month} locked={locked} />
      </div>
      {locked ? <p className="mb-4 font-bold text-[var(--accent)]">החודש נעול. אי אפשר לשנות דיווחים עד שייפתח מחדש.</p> : null}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-sm text-[var(--muted)]">לתשלום</p>
          <p className="text-2xl font-black">{formatMoney(report.totalAmount)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[var(--muted)]">שעות מאושרות</p>
          <p className="text-2xl font-black">{formatHours(report.totalHours)}</p>
        </div>
      </div>

      {report.workers.length === 0 ? (
        <EmptyState text="אין שעות מאושרות בחודש הזה." />
      ) : (
        <div className="grid gap-3">
          {report.workers.map((row) => (
            <article key={row.user.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold">{row.user.name}</h3>
                  <p className="text-sm text-[var(--muted)]">{row.user.phone}</p>
                  {row.user.profile?.bankDetails ? (
                    <p className="text-sm">{row.user.profile.paymentMethod === "bank" ? "בנק" : "ביט"}: {row.user.profile.bankDetails}</p>
                  ) : null}
                </div>
                <div className="text-left">
                  <p className="text-xl font-black">{formatMoney(row.amount)}</p>
                  <p className="text-sm text-[var(--muted)]">{formatHours(row.hours)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
