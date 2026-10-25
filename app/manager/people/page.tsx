import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { NamedItemForm, RateForm } from "@/components/manager-forms";
import { PeopleNav, PEOPLE_TABS, parsePeopleTab } from "@/components/people-nav";
import { WorkersPanel } from "@/components/workers-panel";
import { PageTitle } from "@/components/shell";
import { joinToken } from "@/lib/join";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const manager = await requireManager();
  const tab = parsePeopleTab((await searchParams).tab);
  const current = PEOPLE_TABS.find((item) => item.id === tab) ?? PEOPLE_TABS[0];
  const needUsers = tab === "workers" || tab === "rates";
  const [users, sites, jobs, rates] = await Promise.all([
    needUsers
      ? prisma.user.findMany({ include: { profile: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    tab === "sites" ? prisma.site.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    tab === "jobs" || tab === "rates"
      ? prisma.jobType.findMany({ orderBy: { name: "asc" } })
      : Promise.resolve([]),
    tab === "rates"
      ? prisma.payRate.findMany({ include: { jobType: true, user: true }, orderBy: { hourlyRate: "desc" } })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageTitle title="ניהול" subtitle={current.subtitle} />
      <PeopleNav current={tab} />

      {tab === "workers" ? (
        <WorkersPanel users={users} managerId={manager.id} joinToken={joinToken()} />
      ) : null}

      {tab === "sites" ? (
        <section className="grid gap-3">
          <div className="card p-4">
            <NamedItemForm kind="site" />
          </div>
          {sites.length === 0 ? (
            <p className="text-[var(--muted)]">אין מקומות עדיין.</p>
          ) : (
            sites.map((site) => (
              <div key={site.id} className="card p-4">
                <NamedItemForm kind="site" item={site} />
              </div>
            ))
          )}
        </section>
      ) : null}

      {tab === "jobs" ? (
        <section className="grid gap-3">
          <div className="card p-4">
            <NamedItemForm kind="job" />
          </div>
          {jobs.length === 0 ? (
            <p className="text-[var(--muted)]">אין סוגי עבודה עדיין.</p>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="card p-4">
                <NamedItemForm kind="job" item={job} />
              </div>
            ))
          )}
        </section>
      ) : null}

      {tab === "rates" ? (
        <section className="grid gap-3">
          <h3 className="text-lg font-extrabold">תעריף חדש</h3>
          <RateForm jobs={jobs} workers={users.filter((user) => user.role === "worker")} />
          {rates.length === 0 ? (
            <p className="text-[var(--muted)]">אין תעריפים עדיין.</p>
          ) : (
            rates.map((rate) => (
              <RateForm
                key={rate.id}
                jobs={jobs}
                workers={users.filter((user) => user.role === "worker")}
                rate={rate}
              />
            ))
          )}
        </section>
      ) : null}
    </>
  );
}
