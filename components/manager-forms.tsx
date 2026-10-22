"use client";

import { useState, useTransition } from "react";
import {
  createShiftAction,
  lockPeriodAction,
  upsertNamedItemAction,
  upsertPayRateAction,
  upsertWorkerAction,
} from "@/lib/actions";

function ErrorText({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-sm font-bold text-[var(--danger)]">{error}</p>;
}

export function ShiftForm({
  workers,
  sites,
  jobs,
}: {
  workers: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  jobs: { id: string; name: string }[];
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      className="card grid gap-3 p-4"
      action={(formData) => {
        start(async () => {
          const result = await createShiftAction(formData);
          if (!result.ok) {
            setError(result.error);
            setMessage("");
            return;
          }
          setError("");
          setMessage(result.warnings.length ? `נשמר. שימו לב: ${result.warnings.join(" ")}` : "המשמרת שובצה.");
        });
      }}
    >
      <label className="field">
        <span>עובד</span>
        <select name="userId" required>
          {workers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>מקום</span>
        <select name="siteId" required>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>סוג עבודה</span>
        <select name="jobTypeId" required>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>תאריך</span>
        <input type="date" name="workDate" required />
      </label>
      <label className="field">
        <span>שעת התחלה (לא חובה)</span>
        <input type="time" name="startTime" />
      </label>
      <label className="field">
        <span>שעת סיום (לא חובה)</span>
        <input type="time" name="endTime" />
      </label>
      <p className="text-sm text-[var(--muted)]">אפשר לשבץ רק תאריך, והעובדים יתאמו שעות בצ'אט של אותו יום.</p>
      <label className="field">
        <span>הערה</span>
        <input name="notes" />
      </label>
      <ErrorText error={error} />
      {message ? <p className="text-sm font-bold text-[var(--ok)]">{message}</p> : null}
      <button className="btn" disabled={pending}>
        שיבוץ משמרת
      </button>
    </form>
  );
}

export function WorkerForm({
  worker,
}: {
  worker?: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    role: string;
    active: boolean;
    profile?: {
      birthDate: Date | null;
      parentPhone: string | null;
      paymentMethod: string | null;
      bankDetails: string | null;
      personalRate: number | null;
    } | null;
  };
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const birthDate = worker?.profile?.birthDate ? worker.profile.birthDate.toISOString().slice(0, 10) : "";

  return (
    <form
      className="card grid gap-3 p-4"
      action={(formData) => {
        start(async () => {
          const result = await upsertWorkerAction(formData);
          setError(result.ok ? "" : result.error);
        });
      }}
    >
      {worker ? <input type="hidden" name="id" value={worker.id} /> : null}
      <label className="field">
        <span>שם</span>
        <input name="name" defaultValue={worker?.name} required />
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
      <ErrorText error={error} />
    </form>
  );
}

export function RateForm({
  jobs,
  workers,
}: {
  jobs: { id: string; name: string }[];
  workers: { id: string; name: string }[];
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="card grid gap-3 p-4"
      action={(formData) => {
        start(async () => {
          const result = await upsertPayRateAction(formData);
          setError(result.ok ? "" : result.error);
        });
      }}
    >
      <label className="field">
        <span>סוג עבודה</span>
        <select name="jobTypeId">
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
        <select name="userId">
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
          <input type="number" name="minAge" />
        </label>
        <label className="field">
          <span>עד גיל</span>
          <input type="number" name="maxAge" />
        </label>
      </div>
      <label className="field">
        <span>שכר לשעה</span>
        <input type="number" step="0.1" name="hourlyRate" required />
      </label>
      <ErrorText error={error} />
      <button className="btn" disabled={pending}>
        שמירת תעריף
      </button>
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
