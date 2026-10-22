import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { NamedItemForm, RateForm, WorkerForm } from "@/components/manager-forms";
import { PageTitle } from "@/components/shell";
import { formatMoney } from "@/lib/format";

export default async function PeoplePage() {
  await requireManager();
  const [users, sites, jobs, rates] = await Promise.all([
    prisma.user.findMany({ include: { profile: true }, orderBy: { name: "asc" } }),
    prisma.site.findMany({ orderBy: { name: "asc" } }),
    prisma.jobType.findMany({ orderBy: { name: "asc" } }),
    prisma.payRate.findMany({ include: { jobType: true, user: true }, orderBy: { hourlyRate: "desc" } }),
  ]);

  return (
    <>
      <PageTitle title="ניהול" subtitle="עובדים, מקומות, סוגי עבודה ותעריפים." />

      <h3 className="mb-2 text-lg font-extrabold">עובד חדש</h3>
      <WorkerForm />

      <h3 className="mb-2 mt-8 text-lg font-extrabold">עובדים</h3>
      <div className="grid gap-3">
        {users.map((user) => (
          <details key={user.id} className="card p-4">
            <summary className="cursor-pointer font-extrabold">
              {user.name} · {user.phone} {user.active ? "" : "(לא פעיל)"}
            </summary>
            <div className="mt-3">
              <WorkerForm worker={user} />
            </div>
          </details>
        ))}
      </div>

      <h3 className="mb-2 mt-8 text-lg font-extrabold">מקומות עבודה</h3>
      <div className="card mb-3 p-4">
        <NamedItemForm kind="site" />
      </div>
      <div className="grid gap-2">
        {sites.map((site) => (
          <div key={site.id} className="card p-4">
            <NamedItemForm kind="site" item={site} />
          </div>
        ))}
      </div>

      <h3 className="mb-2 mt-8 text-lg font-extrabold">סוגי עבודה</h3>
      <div className="card mb-3 p-4">
        <NamedItemForm kind="job" />
      </div>
      <div className="grid gap-2">
        {jobs.map((job) => (
          <div key={job.id} className="card p-4">
            <NamedItemForm kind="job" item={job} />
          </div>
        ))}
      </div>

      <h3 className="mb-2 mt-8 text-lg font-extrabold">תעריפים</h3>
      <RateForm jobs={jobs} workers={users.filter((user) => user.role === "worker")} />
      <div className="mt-3 grid gap-2">
        {rates.map((rate) => (
          <div key={rate.id} className="card p-4 text-sm">
            <p className="font-bold">{formatMoney(rate.hourlyRate)} לשעה</p>
            <p className="text-[var(--muted)]">
              {rate.user?.name || "כל העובדים"}
              {rate.jobType ? ` · ${rate.jobType.name}` : " · כל העבודות"}
              {rate.minAge != null || rate.maxAge != null ? ` · גיל ${rate.minAge ?? "*"}–${rate.maxAge ?? "*"}` : ""}
              {rate.active ? "" : " · כבוי"}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
