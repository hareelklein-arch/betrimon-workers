import { requireUser } from "@/lib/auth";
import { EmptyState, PageTitle } from "@/components/shell";
import { formatHours, formatMoney, formatMonth } from "@/lib/format";
import { workerStats } from "@/lib/queries";

export default async function StatsPage() {
  const user = await requireUser();
  const stats = await workerStats(user.id);

  return (
    <>
      <PageTitle title="כמה הרווחתי" subtitle="רק שעות שהמנהל אישר נכנסות לכאן. בלי מס ולפני נטו." />
      <p className="mb-4">
        <a className="font-bold text-[var(--primary)]" href="/worker/history">
          לעבודות שסיימתי
        </a>
      </p>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-sm text-[var(--muted)]">סה״כ מאושר</p>
          <p className="text-2xl font-black">{formatMoney(stats.totalAmount)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[var(--muted)]">שעות</p>
          <p className="text-2xl font-black">{formatHours(stats.totalHours)}</p>
        </div>
      </div>

      <h3 className="mb-2 text-lg font-extrabold">לפי חודש</h3>
      {stats.months.length === 0 ? (
        <EmptyState text="עדיין אין שכר מאושר." />
      ) : (
        <div className="mb-6 grid gap-2">
          {stats.months.map((row) => (
            <div key={`${row.year}-${row.month}`} className="card flex items-center justify-between p-4">
              <div>
                <p className="font-bold">{formatMonth(row.year, row.month)}</p>
                <p className="text-sm text-[var(--muted)]">{formatHours(row.hours)}</p>
              </div>
              <p className="text-lg font-black">{formatMoney(row.amount)}</p>
            </div>
          ))}
        </div>
      )}

      <h3 className="mb-2 text-lg font-extrabold">לפי מקום</h3>
      {stats.sites.length === 0 ? (
        <EmptyState text="אין עדיין פירוט לפי מקום." />
      ) : (
        <div className="grid gap-2">
          {stats.sites.map((row) => (
            <div key={row.name} className="card flex items-center justify-between p-4">
              <div>
                <p className="font-bold">{row.name}</p>
                <p className="text-sm text-[var(--muted)]">{formatHours(row.hours)}</p>
              </div>
              <p className="font-black">{formatMoney(row.amount)}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
