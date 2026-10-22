"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelShiftAction,
  createShiftAction,
  lockPeriodAction,
  requestOtpAction,
  requestSwapAction,
  reviewTimeEntryAction,
  submitTimeEntryAction,
  takeSwapAction,
  upsertNamedItemAction,
  upsertPayRateAction,
  upsertWorkerAction,
  verifyOtpAction,
} from "@/lib/actions";

function ErrorText({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-sm font-bold text-[var(--danger)]">{error}</p>;
}

export function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [demoCode, setDemoCode] = useState<string>();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-3"
      action={(formData) => {
        start(async () => {
          setError("");
          if (step === "phone") {
            const result = await requestOtpAction(formData);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setDemoCode(result.demoCode);
            setStep("code");
            return;
          }
          const result = await verifyOtpAction(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.replace(result.role === "manager" ? "/manager" : "/worker");
          router.refresh();
        });
      }}
    >
      <label className="field">
        <span>טלפון</span>
        <input
          name="phone"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="0500000001"
          required
        />
      </label>
      {step === "code" ? (
        <label className="field">
          <span>קוד בן 6 ספרות</span>
          <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
        </label>
      ) : null}
      {demoCode ? <p className="text-sm text-[var(--muted)]">קוד לפיתוח: {demoCode}</p> : null}
      <ErrorText error={error} />
      <button className="btn" disabled={pending}>
        {step === "phone" ? "שליחת קוד" : "כניסה"}
      </button>
    </form>
  );
}

export function TimeEntryForm({
  sites,
  jobs,
  shifts,
}: {
  sites: { id: string; name: string }[];
  jobs: { id: string; name: string }[];
  shifts: { id: string; label: string; siteId: string; jobTypeId: string; workDate: string; startTime?: string; endTime?: string }[];
}) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, start] = useTransition();
  const [shiftId, setShiftId] = useState("");
  const selected = shifts.find((shift) => shift.id === shiftId);

  return (
    <form
      className="card grid gap-3 p-4"
      action={(formData) => {
        start(async () => {
          const result = await submitTimeEntryAction(formData);
          setError(result.ok ? "" : result.error);
          setSuccess(result.ok ? "הדיווח נשלח לאישור המנהל." : "");
        });
      }}
    >
      <label className="field">
        <span>משמרת משובצת (לא חובה)</span>
        <select name="shiftId" value={shiftId} onChange={(event) => setShiftId(event.target.value)}>
          <option value="">דיווח חופשי</option>
          {shifts.map((shift) => (
            <option key={shift.id} value={shift.id}>
              {shift.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>תאריך</span>
        <input type="date" name="workDate" defaultValue={selected?.workDate} required />
      </label>
      <label className="field">
        <span>איפה</span>
        <select name="siteId" defaultValue={selected?.siteId} key={selected?.siteId} required>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>מה העבודה</span>
        <select name="jobTypeId" defaultValue={selected?.jobTypeId} key={selected?.jobTypeId} required>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>שעת התחלה</span>
        <input type="time" name="startTime" defaultValue={selected?.startTime} key={`start-${selected?.id || "free"}`} required />
      </label>
      <label className="field">
        <span>שעת סיום</span>
        <input type="time" name="endTime" defaultValue={selected?.endTime} key={`end-${selected?.id || "free"}`} required />
      </label>
      <p className="text-sm text-[var(--muted)]">חובה למלא התחלה וסיום. מספר השעות מחושב מהן אוטומטית.</p>
      <label className="field">
        <span>הערה</span>
        <textarea name="note" rows={3} />
      </label>
      <ErrorText error={error} />
      {success ? <p className="text-sm font-bold text-[var(--ok)]">{success}</p> : null}
      <button className="btn" disabled={pending}>
        שליחת דיווח לאישור
      </button>
    </form>
  );
}

export function ActionButton({
  action,
  label,
  className = "btn",
  hidden,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
  label: string;
  className?: string;
  hidden?: Record<string, string>;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      action={(formData) => {
        start(async () => {
          const result = await action(formData);
          if (result && "ok" in result && !result.ok) {
            setError(result.error || "שגיאה");
          }
        });
      }}
    >
      {hidden
        ? Object.entries(hidden).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)
        : null}
      <button className={className} disabled={pending}>
        {label}
      </button>
      <ErrorText error={error} />
    </form>
  );
}

export function ReviewForm({ id }: { id: string }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function submit(decision: "approved" | "rejected") {
    return (formData: FormData) => {
      formData.set("id", id);
      formData.set("decision", decision);
      start(async () => {
        const result = await reviewTimeEntryAction(formData);
        setError(result.ok ? "" : result.error);
      });
    };
  }

  return (
    <form className="grid gap-2">
      <textarea name="rejectionReason" placeholder="סיבת דחייה, אם דוחים" rows={2} />
      <div className="flex gap-2">
        <button className="btn" formAction={submit("approved")} disabled={pending}>
          אישור
        </button>
        <button className="btn btn-danger" formAction={submit("rejected")} disabled={pending}>
          דחייה
        </button>
      </div>
      <ErrorText error={error} />
    </form>
  );
}

export const swapRequest = requestSwapAction;
export const swapTake = takeSwapAction;
export const shiftCreate = createShiftAction;
export const shiftCancel = cancelShiftAction;
export const namedUpsert = upsertNamedItemAction;
export const workerUpsert = upsertWorkerAction;
export const rateUpsert = upsertPayRateAction;
export const periodLock = lockPeriodAction;
