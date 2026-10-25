"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createShiftAction,
  deleteNamedItemAction,
  deletePayRateAction,
  deleteWorkerAction,
  lockPeriodAction,
  suggestWorkersAction,
  upsertNamedItemAction,
  upsertPayRateAction,
  upsertWorkerAction,
} from "@/lib/actions";
import { formatHours } from "@/lib/format";

function ErrorText({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-sm font-bold text-[var(--danger)]">{error}</p>;
}

type WorkerOption = {
  id: string;
  name: string;
  hours?: number;
  shifts?: number;
  assignedThatDay?: boolean;
  assignedToThisJob?: boolean;
  regular?: boolean;
};

function WorkerPickRow({
  worker,
  checked,
  onChange,
}: {
  worker: WorkerOption;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className={`flex items-start gap-3 rounded-2xl border p-3 ${checked ? "border-[var(--primary)] bg-[#e7f3ea]" : "border-[var(--line)]"}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-1 h-5 w-5" />
      <span>
        <span className="font-extrabold">{worker.name}</span>
        <span className="block text-sm text-[var(--muted)]">
          {formatHours(worker.hours ?? 0)} החודש · {worker.shifts === 1 ? "שיבוץ אחד" : `${worker.shifts ?? 0} שיבוצים`}
          {worker.assignedThatDay ? " · כבר משובץ/ת ביום הזה" : ""}
        </span>
      </span>
    </label>
  );
}

const MIN_CREW = 2;
const MAX_CREW = 4;
const CREW_SIZES = [2, 3, 4] as const;

function comboKey(jobTypeId: string, siteId: string) {
  return `${jobTypeId}|${siteId}`;
}

function firstOpenCombo(
  jobs: { id: string }[],
  sites: { id: string }[],
  occupied: { jobTypeId: string; siteId: string }[],
) {
  const taken = new Set(occupied.map((item) => comboKey(item.jobTypeId, item.siteId)));
  for (const job of jobs) {
    for (const site of sites) {
      if (!taken.has(comboKey(job.id, site.id))) {
        return { jobTypeId: job.id, siteId: site.id };
      }
    }
  }
  return { jobTypeId: jobs[0]?.id ?? "", siteId: sites[0]?.id ?? "" };
}

function pickCrew(workers: WorkerOption[], count: number) {
  const open = workers.filter((worker) => !worker.assignedToThisJob);
  const free = open.filter((worker) => !worker.assignedThatDay);
  const busy = open.filter((worker) => worker.assignedThatDay);
  const regularsFirst = (list: WorkerOption[]) => [
    ...list.filter((worker) => worker.regular),
    ...list.filter((worker) => !worker.regular),
  ];
  const needed = Math.min(Math.max(count, 0), open.length, MAX_CREW);
  return regularsFirst(free).concat(regularsFirst(busy)).slice(0, needed);
}

export function ShiftForm({
  sites,
  jobs,
  workers,
  workDate,
  dateLabel,
  occupied = [],
}: {
  sites: { id: string; name: string }[];
  jobs: { id: string; name: string }[];
  workers: { id: string; name: string }[];
  workDate?: string;
  dateLabel?: string;
  occupied?: { jobTypeId: string; siteId: string }[];
}) {
  const router = useRouter();
  const initial = firstOpenCombo(jobs, sites, occupied);
  const [jobTypeId, setJobTypeId] = useState(initial.jobTypeId);
  const [siteId, setSiteId] = useState(initial.siteId);
  const [crewSize, setCrewSize] = useState(2);
  const [options, setOptions] = useState<WorkerOption[]>(workers);
  const [selected, setSelected] = useState<string[]>([]);
  const [trainees, setTrainees] = useState<string[]>([]);
  const [showTrainees, setShowTrainees] = useState(false);
  const [ranked, setRanked] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const availableWorkers = options.filter((worker) => !worker.assignedToThisJob);
  const selectedWorkers = selected
    .map((id) => options.find((worker) => worker.id === id))
    .filter((worker): worker is WorkerOption => Boolean(worker));
  const otherWorkers = availableWorkers.filter((worker) => !selected.includes(worker.id));
  const alreadyOnJob = options.filter((worker) => worker.assignedToThisJob);
  const traineeCandidates = otherWorkers.filter((worker) => !worker.regular);

  const alreadyCount = alreadyOnJob.length;
  const remainingSlots = Math.max(0, MAX_CREW - alreadyCount);

  function applyCrew(list: WorkerOption[], count = crewSize) {
    const already = list.filter((worker) => worker.assignedToThisJob).length;
    const remaining = Math.max(0, MAX_CREW - already);
    const crew = pickCrew(list, Math.min(count, remaining));
    const crewIds = crew.length >= MIN_CREW ? crew.map((worker) => worker.id) : [];
    setOptions(list);
    setSelected(crewIds);
    setTrainees((current) => current.filter((id) => !crewIds.includes(id) && list.some((worker) => worker.id === id && !worker.regular)));
    setRanked(true);
  }

  useEffect(() => {
    if (!workDate || !jobTypeId || !siteId) return;
    const formData = new FormData();
    formData.set("workDate", workDate);
    formData.set("jobTypeId", jobTypeId);
    formData.set("siteId", siteId);
    start(async () => {
      const result = await suggestWorkersAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError("");
      applyCrew(result.workers);
    });
  }, [workDate, jobTypeId, siteId]);

  function toggleWorker(id: string) {
    setTrainees((current) => current.filter((item) => item !== id));
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      const cap = Math.min(crewSize, remainingSlots);
      if (cap < MIN_CREW) return current;
      if (current.length >= cap) return [...current.slice(0, -1), id];
      return [...current, id];
    });
  }

  function toggleTrainee(id: string) {
    setSelected((current) => current.filter((item) => item !== id));
    setTrainees((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <form
      className="grid gap-3"
      action={(formData) => {
        if (pending) return;
        start(async () => {
          if (selected.length < MIN_CREW) {
            setError("חייבים לפחות 2 עובדים. מתלמדים מוסיפים בנפרד.");
            setMessage("");
            return;
          }
          if (selected.length > MAX_CREW) {
            setError("אפשר לשבץ עד 4 עובדים.");
            setMessage("");
            return;
          }
          const result = await createShiftAction(formData);
          if (!result.ok) {
            setError(result.error);
            setMessage("");
            return;
          }
          setError("");
          setMessage(
            result.warnings.length
              ? `נשמר. שימו לב: ${result.warnings.join(" ")} אפשר לשבץ עבודה נוספת ליום הזה.`
              : "העבודה שובצה. אפשר לשבץ עבודה נוספת ליום הזה.",
          );
          setTrainees([]);
          setShowTrainees(false);
          setCrewSize(2);
          const next = firstOpenCombo(jobs, sites, [...occupied, { jobTypeId, siteId }]);
          if (next.jobTypeId !== jobTypeId || next.siteId !== siteId) {
            setJobTypeId(next.jobTypeId);
            setSiteId(next.siteId);
          } else {
            const refresh = new FormData();
            refresh.set("workDate", workDate || String(formData.get("workDate") || ""));
            refresh.set("jobTypeId", jobTypeId);
            refresh.set("siteId", siteId);
            const rankedResult = await suggestWorkersAction(refresh);
            if (rankedResult.ok) applyCrew(rankedResult.workers);
          }
          router.refresh();
        });
      }}
    >
      <div>
        <h3 className="text-lg font-extrabold">עבודה חדשה</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {occupied.length > 0
            ? "אפשר לשבץ עוד עבודה באותו יום. בחרו סוג עבודה ומקום, והמערכת תבחר עובדים."
            : "בחרו סוג עבודה ומקום, והמערכת תבחר עובדים."}
        </p>
      </div>
      <label className="field">
        <span>סוג עבודה</span>
        <select name="jobTypeId" value={jobTypeId} onChange={(event) => setJobTypeId(event.target.value)} required>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>מקום</span>
        <select name="siteId" value={siteId} onChange={(event) => setSiteId(event.target.value)} required>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      {workDate ? (
        <>
          <input type="hidden" name="workDate" value={workDate} />
          {dateLabel ? (
            <p className="font-bold">{occupied.length > 0 ? `עבודה נוספת ל־${dateLabel}` : `שיבוץ ל־${dateLabel}`}</p>
          ) : null}
        </>
      ) : (
        <label className="field">
          <span>תאריך</span>
          <input type="date" name="workDate" required />
        </label>
      )}
      <label className="field">
        <span>הערה</span>
        <input name="notes" />
      </label>
      <label className="field">
        <span>כמה עובדים</span>
        <select
          name="crewSize"
          value={crewSize}
          onChange={(event) => {
            const next = Number(event.target.value);
            setCrewSize(next);
            if (!ranked) return;
            setSelected((current) => {
              const target = Math.min(next, remainingSlots);
              const keep = current.filter((id) => availableWorkers.some((worker) => worker.id === id)).slice(0, target);
              if (keep.length >= MIN_CREW && keep.length >= target) return keep;
              const extras = pickCrew(options, target)
                .map((worker) => worker.id)
                .filter((id) => !keep.includes(id));
              const nextSelected = [...keep, ...extras].slice(0, target);
              return nextSelected.length >= MIN_CREW ? nextSelected : [];
            });
          }}
        >
          {CREW_SIZES.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-2xl border border-[var(--line)] bg-white p-3">
        <p className="mb-2 font-bold">עובדים שהמערכת בחרה</p>
        <p className="mb-3 text-sm text-[var(--muted)]">
          2 עד 4 עובדים. המערכת ממליצה לפי מי שעבד הכי פחות. אפשר להוריד מישהו ולבחור אחר במקומו.
        </p>
        {selected.map((id) => (
          <input key={id} type="hidden" name="userId" value={id} />
        ))}
        {selectedWorkers.length === 0 ? (
          <div className="grid gap-2">
            <p className="text-[var(--muted)]">
              {!ranked
                ? "מחשבים שיבוץ הוגן..."
                : remainingSlots < MIN_CREW
                  ? "העבודה הזו כבר משובצת ביום הזה. בחרו סוג עבודה או מקום אחר כדי לפתוח עבודה חדשה."
                  : availableWorkers.length < MIN_CREW
                    ? "אין מספיק עובדים פנויים. חייבים לפחות 2."
                    : "אין עובדים פנויים לעבודה הזו."}
            </p>
            {ranked && remainingSlots < MIN_CREW ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const next = firstOpenCombo(jobs, sites, occupied);
                  setJobTypeId(next.jobTypeId);
                  setSiteId(next.siteId);
                }}
              >
                עבודה חדשה
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-2">
            {selectedWorkers.map((worker) => (
              <WorkerPickRow key={worker.id} worker={worker} checked onChange={() => toggleWorker(worker.id)} />
            ))}
          </div>
        )}
        {otherWorkers.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 font-bold">החלפה לעובד אחר</p>
            <div className="grid gap-2">
              {otherWorkers.map((worker) => (
                <WorkerPickRow key={worker.id} worker={worker} checked={false} onChange={() => toggleWorker(worker.id)} />
              ))}
            </div>
          </div>
        ) : null}
        {!showTrainees ? (
          <button type="button" className="btn btn-secondary mt-3" onClick={() => setShowTrainees(true)}>
            + מתלמדים
          </button>
        ) : (
          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <p className="mb-2 font-bold">מתלמדים</p>
            <p className="mb-3 text-sm text-[var(--muted)]">מי שעדיין לא שובץ אף פעם. אחרי השיבוץ הוא הופך לעובד רגיל.</p>
            {traineeCandidates.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">אין מתלמדים להוסיף.</p>
            ) : (
              <div className="grid gap-2">
                {traineeCandidates.map((worker) => (
                  <label key={worker.id} className="flex items-start gap-3 rounded-2xl border border-dashed border-[var(--line)] p-3">
                    <input
                      type="checkbox"
                      name="traineeId"
                      value={worker.id}
                      checked={trainees.includes(worker.id)}
                      onChange={() => toggleTrainee(worker.id)}
                      className="mt-1 h-5 w-5"
                    />
                    <span>
                      <span className="font-extrabold">{worker.name}</span>
                      <span className="block text-sm text-[var(--muted)]">מתלמד/ת</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        {alreadyOnJob.length > 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">כבר משובצים לעבודה הזו: {alreadyOnJob.map((worker) => worker.name).join(", ")}</p>
        ) : null}
      </div>

      <ErrorText error={error} />
      {message ? <p className="text-sm font-bold text-[var(--ok)]">{message}</p> : null}
      {ranked && selected.length > 0 && selected.length < Math.min(crewSize, remainingSlots) ? (
        <p className="text-sm font-bold text-[var(--accent)]">
          יש רק {selected.length} עובדים פנויים.
        </p>
      ) : null}
      <button className="btn w-full" disabled={pending || selected.length < MIN_CREW || selected.length > MAX_CREW}>
        שיבוץ
      </button>
    </form>
  );
}

export function WorkerForm({
  worker,
  plain,
  onSuccess,
}: {
  worker?: {
    id: string;
    name: string;
    username: string;
    phone: string;
    email: string | null;
    role: string;
    active: boolean;
    profile?: {
      birthDate: Date | string | null;
      parentPhone: string | null;
      paymentMethod: string | null;
      bankDetails: string | null;
      personalRate: number | null;
    } | null;
  };
  plain?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const birthDate = worker?.profile?.birthDate
    ? new Date(worker.profile.birthDate).toISOString().slice(0, 10)
    : "";

  return (
    <form
      className={plain ? "grid gap-3" : "card grid gap-3 p-4"}
      action={(formData) => {
        start(async () => {
          const result = await upsertWorkerAction(formData);
          setError(result.ok ? "" : result.error);
          if (result.ok) {
            router.refresh();
            onSuccess?.();
          }
        });
      }}
    >
      {worker ? <input type="hidden" name="id" value={worker.id} /> : null}
      <label className="field">
        <span>שם</span>
        <input name="name" defaultValue={worker?.name} required />
      </label>
      <label className="field">
        <span>שם משתמש</span>
        <input name="username" autoComplete="off" defaultValue={worker?.username} required />
      </label>
      <label className="field">
        <span>{worker ? "סיסמה חדשה (ריק = בלי שינוי)" : "סיסמה"}</span>
        <input name="password" type="password" autoComplete="new-password" required={!worker} />
      </label>
      <label className="field">
        <span>טלפון</span>
        <input name="phone" defaultValue={worker?.phone} required />
      </label>
      <label className="field">
        <span>אימייל</span>
        <input name="email" defaultValue={worker?.email || ""} />
      </label>
      <label className="field">
        <span>תפקיד</span>
        <select name="role" defaultValue={worker?.role || "worker"}>
          <option value="worker">עובד</option>
          <option value="manager">מנהל</option>
        </select>
      </label>
      <label className="field">
        <span>תאריך לידה</span>
        <input type="date" name="birthDate" defaultValue={birthDate} />
      </label>
      <label className="field">
        <span>טלפון הורה</span>
        <input name="parentPhone" defaultValue={worker?.profile?.parentPhone || ""} />
      </label>
      <label className="field">
        <span>אופן תשלום</span>
        <select name="paymentMethod" defaultValue={worker?.profile?.paymentMethod || "bit"}>
          <option value="bit">ביט</option>
          <option value="bank">העברה בנקאית</option>
        </select>
      </label>
      <label className="field">
        <span>פרטי תשלום</span>
        <input name="bankDetails" defaultValue={worker?.profile?.bankDetails || ""} />
      </label>
      <label className="field">
        <span>תעריף אישי (אופציונלי)</span>
        <input type="number" step="0.1" name="personalRate" defaultValue={worker?.profile?.personalRate || ""} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="active" value="true" defaultChecked={worker?.active ?? true} />
        פעיל
      </label>
      <ErrorText error={error} />
      <button className="btn" disabled={pending}>
        {worker ? "עדכון" : "הוספת עובד"}
      </button>
    </form>
  );
}

export function NamedItemForm({ kind, item }: { kind: "site" | "job"; item?: { id: string; name: string } }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-start gap-2">
      <form
        className="flex flex-wrap gap-2"
        action={(formData) => {
          start(async () => {
            const result = await upsertNamedItemAction(formData);
            setError(result.ok ? "" : result.error);
          });
        }}
      >
        <input type="hidden" name="kind" value={kind} />
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        <input name="name" placeholder="שם" defaultValue={item?.name} required />
        <button className="btn" disabled={pending}>
          {item ? "שמירה" : "הוספה"}
        </button>
      </form>
      {item ? (
        <DeleteNamedItemButton
          kind={kind}
          id={item.id}
          name={item.name}
        />
      ) : null}
      <ErrorText error={error} />
    </div>
  );
}

export function DeleteNamedItemButton({
  kind,
  id,
  name,
}: {
  kind: "site" | "job";
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const confirmText =
    kind === "site"
      ? `למחוק את המקום ${name}? השיבוצים והדיווחים במקום הזה יימחקו.`
      : `למחוק את סוג העבודה ${name}? השיבוצים והדיווחים לסוג הזה יימחקו.`;

  return (
    <form
      action={(formData) => {
        if (!window.confirm(confirmText)) return;
        start(async () => {
          const result = await deleteNamedItemAction(formData);
          setError(result.ok ? "" : result.error);
          if (result.ok) router.refresh();
        });
      }}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-danger" disabled={pending}>
        מחיקה
      </button>
      <ErrorText error={error} />
    </form>
  );
}

export function DeleteWorkerButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      action={(formData) => {
        if (!window.confirm(`למחוק את ${name}? השיבוצים והדיווחים שלו יימחקו.`)) return;
        start(async () => {
          try {
            const result = await deleteWorkerAction(formData);
            setError(result.ok ? "" : result.error);
            if (result.ok) router.refresh();
          } catch (error) {
            setError(error instanceof Error ? error.message : "מחיקה נכשלה.");
          }
        });
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-danger" disabled={pending}>
        מחיקת עובד
      </button>
      <ErrorText error={error} />
    </form>
  );
}

export function RateForm({
  jobs,
  workers,
  rate,
}: {
  jobs: { id: string; name: string }[];
  workers: { id: string; name: string }[];
  rate?: {
    id: string;
    jobTypeId: string | null;
    userId: string | null;
    minAge: number | null;
    maxAge: number | null;
    hourlyRate: number;
    active: boolean;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="card grid gap-3 p-4">
      <form
        className="grid gap-3"
        action={(formData) => {
          start(async () => {
            const result = await upsertPayRateAction(formData);
            setError(result.ok ? "" : result.error);
            if (result.ok) router.refresh();
          });
        }}
      >
        {rate ? <input type="hidden" name="id" value={rate.id} /> : null}
        <label className="field">
          <span>סוג עבודה</span>
          <select name="jobTypeId" defaultValue={rate?.jobTypeId || ""}>
            <option value="">הכול</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>עובד ספציפי</span>
          <select name="userId" defaultValue={rate?.userId || ""}>
            <option value="">לא</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span>מגיל</span>
            <input type="number" name="minAge" defaultValue={rate?.minAge ?? ""} />
          </label>
          <label className="field">
            <span>עד גיל</span>
            <input type="number" name="maxAge" defaultValue={rate?.maxAge ?? ""} />
          </label>
        </div>
        <label className="field">
          <span>שכר לשעה</span>
          <input type="number" step="0.1" name="hourlyRate" defaultValue={rate?.hourlyRate ?? ""} required />
        </label>
        {rate ? (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="active" value="true" defaultChecked={rate.active} />
            פעיל
          </label>
        ) : null}
        <ErrorText error={error} />
        <button className="btn" disabled={pending}>
          {rate ? "עדכון תעריף" : "שמירת תעריף"}
        </button>
      </form>
      {rate ? <DeleteRateButton id={rate.id} /> : null}
    </div>
  );
}

export function DeleteRateButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      action={(formData) => {
        start(async () => {
          const result = await deletePayRateAction(formData);
          setError(result.ok ? "" : result.error);
          if (result.ok) router.refresh();
        });
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-danger" disabled={pending}>
        מחיקה
      </button>
      <ErrorText error={error} />
    </form>
  );
}

export function LockPeriodForm({ year, month, locked }: { year: number; month: number; locked: boolean }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(formData) => {
        start(async () => {
          await lockPeriodAction(formData);
        });
      }}
    >
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="lock" value={locked ? "false" : "true"} />
      <button className={locked ? "btn btn-secondary" : "btn"} disabled={pending}>
        {locked ? "פתיחת החודש מחדש" : "נעילת החודש"}
      </button>
    </form>
  );
}
