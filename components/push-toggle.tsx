"use client";

import { useState } from "react";
import { enablePushNotifications } from "@/lib/push-client";
import { PleaseWait, beginWait, endWait, waitLabel } from "@/components/please-wait";

export function PushToggle() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function enable() {
    beginWait();
    setPending(true);
    const result = await enablePushNotifications();
    setPending(false);
    endWait();
    setMessage(result.ok ? "התראות לטלפון הופעלו." : result.error);
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 text-sm text-[var(--muted)]">
      <PleaseWait show={pending} />
      <button type="button" className="text-sm font-bold text-[var(--primary)]" disabled={pending} onClick={enable}>
        {waitLabel(pending, "הפעלת התראות בטלפון")}
      </button>
      {message ? <span>{message}</span> : null}
    </div>
  );
}
