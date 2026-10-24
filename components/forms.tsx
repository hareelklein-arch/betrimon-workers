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
  shift,
}: {
  shift: {
    id: string;
    label: string;
    siteId: string;
    siteName: string;
    jobTypeId: string;
    jobName: string;
    workDate: string;
    dateLabel: string;
    startTime?: string;
    endTime?: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      className="card grid gap-3 p-4"
      action={(formData) => {
        start(async () => {
          const result = await submitTimeEntryAction(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.replace("/worker");
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="shiftId" value={shift.id} />
      <input type="hidden" name="siteId" value={shift.siteId} />
      <input type="hidden" name="jobTypeId" value={shift.jobTypeId} />
      <input type="hidden" name="workDate" value={shift.workDate} />
      <div className="rounded-2xl bg-[#eef4ef] p-3 text-sm">
        <p className="font-extrabold">{shift.jobName}</p>
        <p>{shift.siteName}</p>
        <p className="text-[var(--muted)]">{shift.dateLabel}</p>
      </div>
      <label className="field">
        <span>שעת התחלה</span>
        <input
          type="text"
          name="startTime"
          defaultValue={shift.startTime}
          required
          dir="ltr"
          inputMode="numeric"
          placeholder="23:00"
          pattern="^([01]?\d|2[0-3]):[0-5]\d$"
          title="שעה בפורמט 24, למשל 23:00"
          autoComplete="off"
        />
      </label>
      <label className="field">
        <span>שעת סיום</span>
        <input
          type="text"
          name="endTime"
          defaultValue={shift.endTime}
          required
          dir="ltr"
          inputMode="numeric"
          placeholder="23:00"
          pattern="^([01]?\d|2[0-3]):[0-5]\d$"
          title="שעה בפורמט 24, למשל 23:00"
          autoComplete="off"
        />
      </label>
      <p className="text-sm text-[var(--muted)]">חובה למלא התחלה וסיום. מספר השעות מחושב מהן אוטומטית.</p>
      <label className="field">
        <span>הערה</span>
        <textarea name="note" rows={3} />
      </label>
      <ErrorText error={error} />
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
