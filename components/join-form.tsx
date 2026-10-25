"use client";

import { useState } from "react";
import { registerWorkerAction } from "@/lib/join-actions";
import { WaitSubmit } from "@/components/please-wait";

export function JoinForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="card p-6">
        <h1 className="text-2xl font-black">הבקשה נשלחה</h1>
        <p className="mt-2 text-[var(--muted)]">המנהלת תאשר את החשבון. אחרי האישור אפשר להיכנס עם שם המשתמש והסיסמה שבחרתם.</p>
      </div>
    );
  }

  return (
    <form
      className="card grid gap-3 p-6"
      action={async (formData) => {
        const result = await registerWorkerAction(formData);
        setError(result.ok ? "" : result.error);
        if (result.ok) setDone(true);
      }}
    >
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-[var(--muted)]">בית רימון</p>
      <h1 className="text-2xl font-black">רישום עובד</h1>
      <p className="text-[var(--muted)]">מלאו פרטים. החשבון ייפתח רק אחרי אישור המנהלת.</p>
      <label className="field">
        <span>שם</span>
        <input name="name" required />
      </label>
      <label className="field">
        <span>שם משתמש</span>
        <input name="username" autoComplete="off" required />
      </label>
      <label className="field">
        <span>סיסמה</span>
        <input name="password" type="password" autoComplete="new-password" minLength={6} required />
      </label>
      <label className="field">
        <span>טלפון</span>
        <input name="phone" required />
      </label>
      <label className="field">
        <span>אימייל</span>
        <input name="email" type="email" />
      </label>
      <label className="field">
        <span>תאריך לידה</span>
        <input type="date" name="birthDate" />
      </label>
      <label className="field">
        <span>טלפון הורה</span>
        <input name="parentPhone" />
      </label>
      <label className="field">
        <span>אופן תשלום</span>
        <select name="paymentMethod" defaultValue="bit">
          <option value="bit">ביט</option>
          <option value="bank">העברה בנקאית</option>
        </select>
      </label>
      <label className="field">
        <span>פרטי תשלום</span>
        <input name="bankDetails" />
      </label>
      {error ? <p className="text-sm font-bold text-[var(--danger)]">{error}</p> : null}
      <WaitSubmit label="שליחת בקשה" />
    </form>
  );
}
