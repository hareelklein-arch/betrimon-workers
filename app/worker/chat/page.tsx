import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageTitle } from "@/components/shell";
import { formatDate } from "@/lib/format";
import { dateWorkIsFinished } from "@/lib/chat";
import { parseDateKey, shiftDateKey, shiftDay } from "@/lib/shift";

export default async function ChatListPage() {
  const user = await requireUser();
  const shifts = await prisma.shift.findMany({
    where: { status: { not: "cancelled" } },
    include: { user: true, site: true, timeEntries: { select: { status: true } } },
    orderBy: [{ workDate: "asc" }, { startsAt: "asc" }],
  });

  const myKeys = new Set(
    shifts.filter((shift) => user.role === "manager" || shift.userId === user.id).map((shift) => shiftDateKey(shift)),
  );

  const grouped = new Map<string, { names: Set<string>; sites: Set<string>; shifts: typeof shifts }>();
  for (const shift of shifts) {
    const key = shiftDateKey(shift);
    if (!myKeys.has(key)) continue;
    const row = grouped.get(key) ?? { names: new Set<string>(), sites: new Set<string>(), shifts: [] };
    row.names.add(shift.user.name);
    row.sites.add(shift.site.name);
    row.shifts.push(shift);
    grouped.set(key, row);
  }
  const finishedKeys: string[] = [];
  for (const [key, row] of grouped) {
    if (dateWorkIsFinished(row.shifts)) {
      grouped.delete(key);
      finishedKeys.push(key);
    }
  }
  if (finishedKeys.length > 0) {
    await prisma.dateChatMessage.deleteMany({ where: { workDateKey: { in: finishedKeys } } });
  }

  const keys = [...grouped.keys()].sort();
  const lastMessages = await prisma.dateChatMessage.findMany({
    where: { workDateKey: { in: keys } },
    orderBy: { createdAt: "desc" },
  });
  const lastByDate = new Map<string, string>();
  for (const message of lastMessages) {
    if (!lastByDate.has(message.workDateKey)) {
      lastByDate.set(message.workDateKey, message.body);
    }
  }

  return (
    <>
      <PageTitle title="צ'אט לפי יום עבודה" subtitle="כל תאריך ששובצתם אליו הוא קבוצה קטנה. שם מתאמים מתי עובדים." />
      {keys.length === 0 ? (
        <EmptyState text="אין עדיין תאריך משובץ לפתוח עליו צ'אט." />
      ) : (
        <div className="grid gap-3">
          {keys.map((key) => {
            const row = grouped.get(key);
            const day = parseDateKey(key) ?? shiftDay({ workDate: new Date() });
            return (
              <Link key={key} href={`/worker/chat/${key}`} className="card block p-4">
                <h3 className="text-lg font-extrabold">{formatDate(day)}</h3>
                <p className="text-sm text-[var(--muted)]">{[...row?.sites ?? []].join(" · ")}</p>
                <p className="mt-1 text-sm">{[...row?.names ?? []].join(", ")}</p>
                {lastByDate.get(key) ? (
                  <p className="mt-2 truncate text-sm text-[var(--muted)]">{lastByDate.get(key)}</p>
                ) : (
                  <p className="mt-2 text-sm text-[var(--accent)]">עדיין אין הודעות — אפשר להתחיל לתאם שעות.</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
