"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ShiftForm } from "@/components/manager-forms";
import { ScheduleImportForm } from "@/components/schedule-import";
import { cancelShiftsAction } from "@/lib/actions";
import { formatDate, formatMonth, toDateInput } from "@/lib/format";
import { PleaseWait, busy, waitLabel } from "@/components/please-wait";

export type BoardShift = {
  id: string;
  userId: string;
  userName: string;
  trainee: boolean;
  jobTypeId: string;
  jobName: string;
  siteId: string;
  siteName: string;
  date: string;
};

const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function monthHref(year: number, month: number) {
  return `/manager?year=${year}&month=${month}`;
}

function shiftMonth(year: number, month: number, delta: number) {
  const next = new Date(year, month - 1 + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() + 1 };
}

function cellsForMonth(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < first.getDay(); i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toDateInput(new Date(year, month - 1, day)));
  }
  return cells;
}

function groupsOnDay(shifts: BoardShift[]) {
  const map = new Map<
    string,
    {
      jobTypeId: string;
      siteId: string;
      jobName: string;
      siteName: string;
      workers: { id: string; name: string; shiftId: string; trainee: boolean }[];
    }
  >();
  for (const shift of shifts) {
    const key = `${shift.jobTypeId}|${shift.siteId}`;
    const current =
      map.get(key) ?? {
        jobTypeId: shift.jobTypeId,
        siteId: shift.siteId,
        jobName: shift.jobName,
        siteName: shift.siteName,
        workers: [],
      };
    if (!current.workers.some((worker) => worker.id === shift.userId)) {
      current.workers.push({ id: shift.userId, name: shift.userName, shiftId: shift.id, trainee: shift.trainee });
    }
    map.set(key, current);
  }
  return [...map.values()];
}

function groupCountLabel(workers: { trainee: boolean }[]) {
  const regular = workers.filter((worker) => !worker.trainee).length;
  const trainees = workers.filter((worker) => worker.trainee).length;
  return trainees > 0 ? `${regular}+${trainees}` : String(regular);
}

function workerName(worker: { name: string; trainee: boolean }) {
  return worker.trainee ? `${worker.name} (מתלמד)` : worker.name;
}

function CancelGroupButton({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      action={(formData) => {
        busy(start, async () => {
          try {
            const result = await cancelShiftsAction(formData);
            setError(result.ok ? "" : result.error);
            if (result.ok) router.refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "ביטול השיבוץ נכשל.");
          }
        });
      }}
    >
      {ids.map((id) => (
        <input key={id} type="hidden" name="id" value={id} />
      ))}
      <PleaseWait show={pending} />
      <button className="btn btn-danger" disabled={pending}>
        {waitLabel(pending, "ביטול העבודה")}
      </button>
      {error ? <p className="mt-2 text-sm font-bold text-[var(--danger)]">{error}</p> : null}
    </form>
  );
}

export function MonthBoard({
  year,
  month,
  shifts,
  sites,
  jobs,
  workers,
}: {
  year: number;
  month: number;
  shifts: BoardShift[];
  sites: { id: string; name: string }[];
  jobs: { id: string; name: string }[];
  workers: { id: string; name: string }[];
}) {
  const today = toDateInput(new Date());
  const [openDate, setOpenDate] = useState<string | null>(null);
  const cells = useMemo(() => cellsForMonth(year, month), [year, month]);
  const byDate = useMemo(() => {
    const map = new Map<string, BoardShift[]>();
    for (const shift of shifts) {
      const list = map.get(shift.date) ?? [];
      list.push(shift);
      map.set(shift.date, list);
    }
    return map;
  }, [shifts]);

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const openDateObj = openDate ? new Date(`${openDate}T00:00:00`) : null;
  const openGroups = openDate ? groupsOnDay(byDate.get(openDate) ?? []) : [];

  useEffect(() => {
    if (!openDate) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenDate(null);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [openDate]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={monthHref(next.year, next.month)} className="btn btn-secondary px-3">
          חודש הבא
        </Link>
        <h3 className="text-xl font-black">{formatMonth(year, month)}</h3>
        <Link href={monthHref(prev.year, prev.month)} className="btn btn-secondary px-3">
          חודש קודם
        </Link>
      </div>

      <div className="card overflow-hidden p-2 sm:p-3">
        <div className="mb-1 grid grid-cols-7 text-center text-xs font-bold text-[var(--muted)]">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} />;
            const groups = groupsOnDay(byDate.get(date) ?? []);
            const isOpen = date === openDate;
            const isToday = date === today;
            return (
              <button
                key={date}
                type="button"
                onClick={() => setOpenDate(date)}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                className={`min-h-16 rounded-xl border p-1 text-right sm:min-h-24 ${
                  isOpen ? "border-[var(--primary)] bg-[#e7f3ea]" : "border-[var(--line)] bg-white"
                }`}
              >
                <span className={`text-sm ${isToday ? "font-black text-[var(--primary)]" : "font-bold"}`}>
                  {Number(date.slice(8))}
                </span>
                <div className="mt-1 grid gap-0.5">
                  {groups.slice(0, 3).map((group) => (
                    <span key={`${group.jobName}-${group.siteName}`} className="block truncate text-[10px] leading-tight text-[var(--muted)]">
                      {group.jobName} · {groupCountLabel(group.workers)}
                    </span>
                  ))}
                  {groups.length > 3 ? <span className="text-[10px] text-[var(--muted)]">+{groups.length - 3}</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-sm text-[var(--muted)]">לחצו על יום בלוח כדי לשבץ עבודה.</p>

      <ScheduleImportForm sites={sites} jobs={jobs} workers={workers} />

      {openDate && openDateObj ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="סגירת חלון השיבוץ"
            onClick={() => setOpenDate(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-assign-title"
            className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--card)] pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
              <div>
                <p className="text-xs text-[var(--muted)]">שיבוץ ליום</p>
                <h3 id="day-assign-title" className="text-xl font-black">
                  {formatDate(openDateObj)}
                </h3>
              </div>
              <button type="button" className="btn btn-secondary px-3" onClick={() => setOpenDate(null)}>
                סגירה
              </button>
            </div>
            <div className="grid gap-3 overflow-y-auto p-4">
              {openGroups.length === 0 ? (
                <p className="text-[var(--muted)]">אין שיבוצים ביום הזה עדיין. בחרו עבודה ועובדים ולחצו שיבוץ.</p>
              ) : (
                openGroups.map((group) => (
                  <article key={`${group.jobTypeId}-${group.siteId}`} className="rounded-2xl border border-[var(--line)] bg-white p-4">
                    <p className="font-extrabold">
                      {group.jobName} · {group.siteName}
                    </p>
                    <p className="mt-1 text-sm">{group.workers.map(workerName).join(" · ")}</p>
                    <div className="mt-3">
                      <CancelGroupButton ids={group.workers.map((worker) => worker.shiftId)} />
                    </div>
                  </article>
                ))
              )}
              <ShiftForm
                key={openDate}
                sites={sites}
                jobs={jobs}
                workers={workers}
                workDate={openDate}
                occupied={openGroups.map((group) => ({ jobTypeId: group.jobTypeId, siteId: group.siteId }))}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
